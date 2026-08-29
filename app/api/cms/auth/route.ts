import {
  authenticateLocalCredentials,
  authenticateStudioRequest,
  createSessionToken,
  hasCapability,
  sessionCookie,
  studioUsersFor,
} from "../../../../lib/cms-auth";
import {
  createCmsUser,
  derivePassword,
  getCmsUserCredential,
  getRegistrationSettings,
  updateCmsUser,
  verifyPassword,
} from "../../../../lib/cms-user-store";

const failures = new Map<string, { count: number; resetAt: number }>();
const registrationAttempts = new Map<string, { count: number; resetAt: number }>();

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json({ ok: status < 400, data: status < 400 ? data : undefined, error: status >= 400 ? data : undefined }, { status, headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers).entries()) } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function loginStudioCredentials(request: Request, email: string, password: string) {
  const key = `${request.headers.get("cf-connecting-ip") ?? "local"}:${email.toLowerCase()}`;
  const now = Date.now();
  const failure = failures.get(key);
  if (failure && failure.resetAt > now && failure.count >= 5) {
    return { user: null, error: "Too many sign-in attempts. Try again in 15 minutes.", status: 429 } as const;
  }

  const result = await authenticateLocalCredentials(request, email, password);
  if (!result.user) {
    failures.set(key, { count: failure && failure.resetAt > now ? failure.count + 1 : 1, resetAt: now + 15 * 60 * 1000 });
    return { user: null, error: result.error || "The email or password is incorrect.", status: 401 } as const;
  }
  failures.delete(key);
  return { user: result.user, error: "", status: 200 } as const;
}

export async function GET(request: Request) {
  const user = await authenticateStudioRequest(request);
  const registration = await getRegistrationSettings().catch(() => ({ mode: "closed" as const, default_role: "subscriber" }));
  return json({ authenticated: Boolean(user), user, registration, users: user && hasCapability(user, "manage_users") ? await studioUsersFor(request, user) : [] }, user ? 200 : 401);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json("Cross-origin authentication requests are not allowed.", 403);
  const input = await request.json() as Record<string, unknown>;
  if (input.action === "logout") {
    return json({ authenticated: false }, 200, { "Set-Cookie": sessionCookie(request, "", 0) });
  }
  if (input.action === "signup") {
    const registrationKey = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const now = Date.now();
    const attempt = registrationAttempts.get(registrationKey);
    if (attempt && attempt.resetAt > now && attempt.count >= 5) return json("Too many registration attempts. Try again in 15 minutes.", 429);
    registrationAttempts.set(registrationKey, { count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1, resetAt: now + 15 * 60 * 1000 });
    const registration = await getRegistrationSettings();
    if (registration.mode === "closed") return json("New account registration is currently closed.", 403);
    const email = String(input.email ?? "").trim().toLowerCase();
    const username = String(input.username ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
    const displayName = String(input.display_name ?? "").trim();
    const password = String(input.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) return json("Enter a valid email address.", 400);
    if (username.length < 3) return json("Choose a username with at least three characters.", 400);
    if (displayName.length < 2) return json("Enter the name you want displayed.", 400);
    if (password.length < 10) return json("Use a password with at least 10 characters.", 400);
    const status = registration.mode === "open" ? "active" : "pending";
    try {
      const credential = await derivePassword(password);
      const record = await createCmsUser({ user_key: username, username, email, display_name: displayName, role_key: registration.default_role, status, approved_by: status === "active" ? "open-registration" : "", ...credential, social: {} });
      registrationAttempts.delete(registrationKey);
      if (status === "pending") return json({ authenticated: false, pending: true, message: "Your account was created and is waiting for approval." }, 201);
      const { user } = await authenticateLocalCredentials(request, email, password);
      if (!user) return json("Account created, but sign-in could not be completed.", 502);
      const token = await createSessionToken(request, user);
      return json({ authenticated: true, user, created: record.id }, 201, { "Set-Cookie": sessionCookie(request, token) });
    } catch (error) {
      return json(error instanceof Error ? error.message : "Could not create the account.", 409);
    }
  }
  if (input.action === "updateProfile" || input.action === "changePassword") {
    const current = await authenticateStudioRequest(request);
    if (!current) return json("Sign in to update your account.", 401);
    if (input.action === "changePassword") {
      const currentPassword = String(input.current_password ?? "");
      const nextPassword = String(input.password ?? "");
      if (nextPassword.length < 10) return json("Use a new password with at least 10 characters.", 400);
      const credential = await getCmsUserCredential(Number(current.id));
      if (!(await verifyPassword(currentPassword, credential))) return json("Your current password is incorrect.", 401);
      const nextCredential = await derivePassword(nextPassword);
      await updateCmsUser(Number(current.id), nextCredential);
      return json({ changed: true });
    }
    const updated = await updateCmsUser(Number(current.id), {
      display_name: String(input.display_name ?? current.name).trim(),
      first_name: String(input.first_name ?? current.firstName).trim(),
      last_name: String(input.last_name ?? current.lastName).trim(),
      bio: String(input.bio ?? current.bio).trim(),
      website_url: String(input.website_url ?? current.websiteUrl).trim(),
      avatar_url: String(input.avatar_url ?? current.avatarUrl).trim(),
      social: typeof input.social === "object" && input.social ? input.social as Record<string, string> : current.social,
    });
    return json({ updated });
  }
  if (input.action !== "login") return json("Unsupported authentication action.", 400);

  const result = await loginStudioCredentials(request, String(input.email ?? ""), String(input.password ?? ""));
  if (!result.user) {
    return json(result.error, result.status);
  }
  const token = await createSessionToken(request, result.user);
  return json({ authenticated: true, user: result.user }, 200, { "Set-Cookie": sessionCookie(request, token) });
}
