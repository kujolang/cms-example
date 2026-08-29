import type { Metadata } from "next";
import { headers } from "next/headers";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — CMS Studio",
  description: "Authenticate to access the Field Notes editorial workspace.",
};

export const dynamic = "force-dynamic";

export default async function CmsLoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; reason?: string }> }) {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  const query = await searchParams;
  const requested = query.returnTo ?? "/cms";
  const returnTo = (requested.startsWith("/cms") || requested.startsWith("/account")) && !requested.startsWith("//") ? requested : "/cms";
  return <LoginForm returnTo={returnTo} local={local} reason={query.reason} />;
}
