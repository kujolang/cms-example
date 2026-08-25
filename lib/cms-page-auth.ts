import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateStudioRequest, hasCapability, type CmsCapability } from "./cms-auth";

export async function requireCmsPage(returnTo: string, capability: CmsCapability = "view_content") {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const request = new Request(`${protocol}://${host}${returnTo}`, { headers: incoming });
  const user = await authenticateStudioRequest(request);
  if (!user) redirect(`/cms/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (!hasCapability(user, capability)) redirect("/cms");
  return user;
}
