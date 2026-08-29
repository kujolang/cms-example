import { createSessionToken, sessionCookie } from "../../../../../lib/cms-auth";
import { loginStudioCredentials } from "../route";

function safeReturnTo(value: FormDataEntryValue | null) {
  const requested = String(value ?? "/cms");
  return (requested.startsWith("/cms") || requested.startsWith("/account")) && !requested.startsWith("//") ? requested : "/cms";
}

function failureReason(message: string, status: number) {
  if (status === 429) return "rate_limited";
  if (message.includes("waiting for approval")) return "pending";
  if (message.includes("not approved")) return "rejected";
  if (message.includes("suspended")) return "suspended";
  if (message.includes("not enabled")) return "disabled";
  return "credentials";
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response("Cross-origin authentication requests are not allowed.", { status: 403 });
  const form = await request.formData();
  const returnTo = safeReturnTo(form.get("returnTo"));
  const result = await loginStudioCredentials(request, String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!result.user) {
    const login = new URL("/cms/login", request.url);
    login.searchParams.set("returnTo", returnTo);
    login.searchParams.set("reason", failureReason(result.error, result.status));
    return Response.redirect(login, 303);
  }

  const token = await createSessionToken(request, result.user);
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(returnTo, request.url).toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": sessionCookie(request, token),
    },
  });
}
