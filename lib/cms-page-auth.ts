import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateStudioRequest, hasCapability, type CmsCapability } from "./cms-auth";
import { loadStudioData, type StudioView } from "./cms-studio-data";

async function authenticatedPage(returnTo: string, capability: CmsCapability) {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const request = new Request(`${protocol}://${host}${returnTo}`, { headers: incoming });
  const user = await authenticateStudioRequest(request);
  if (!user) redirect(`/cms/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (!hasCapability(user, capability)) redirect("/account");
  return { request, user };
}

export async function requireCmsPage(returnTo: string, capability: CmsCapability = "view_content") {
  return (await authenticatedPage(returnTo, capability)).user;
}

export async function requireCmsStudioPage(returnTo: string, view: StudioView, capability: CmsCapability = "view_content") {
  const { request, user } = await authenticatedPage(returnTo, capability);
  return await loadStudioData(request, user, view);
}

export async function requireAccountPage(returnTo = "/account") {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const request = new Request(`${protocol}://${host}${returnTo}`, { headers: incoming });
  const user = await authenticateStudioRequest(request);
  if (!user) redirect(`/cms/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}
