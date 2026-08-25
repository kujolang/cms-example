import {
  authenticateLocalCredentials,
  authenticateStudioRequest,
  createSessionToken,
  sessionCookie,
  studioUsersFor,
} from "../../../../lib/cms-auth";

const failures = new Map<string, { count: number; resetAt: number }>();

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json({ ok: status < 400, data: status < 400 ? data : undefined, error: status >= 400 ? data : undefined }, { status, headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers).entries()) } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET(request: Request) {
  const user = await authenticateStudioRequest(request);
  return json({ authenticated: Boolean(user), user, users: user ? studioUsersFor(request, user) : [] }, user ? 200 : 401);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json("Cross-origin authentication requests are not allowed.", 403);
  const input = await request.json() as { action?: string; email?: string; password?: string };
  if (input.action === "logout") {
    return json({ authenticated: false }, 200, { "Set-Cookie": sessionCookie(request, "", 0) });
  }
  if (input.action !== "login") return json("Unsupported authentication action.", 400);

  const key = `${request.headers.get("cf-connecting-ip") ?? "local"}:${String(input.email ?? "").toLowerCase()}`;
  const now = Date.now();
  const failure = failures.get(key);
  if (failure && failure.resetAt > now && failure.count >= 5) return json("Too many sign-in attempts. Try again in 15 minutes.", 429);

  const user = await authenticateLocalCredentials(request, String(input.email ?? ""), String(input.password ?? ""));
  if (!user) {
    failures.set(key, { count: failure && failure.resetAt > now ? failure.count + 1 : 1, resetAt: now + 15 * 60 * 1000 });
    return json("The email or password is incorrect.", 401);
  }
  failures.delete(key);
  const token = await createSessionToken(request, user);
  return json({ authenticated: true, user }, 200, { "Set-Cookie": sessionCookie(request, token) });
}
