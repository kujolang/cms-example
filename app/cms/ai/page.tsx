import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsStudioPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = { title: "AI & automation — CMS Studio", description: "Manage CMS abilities, agent interoperability, and Kujo ecosystem connectors." };
export const dynamic = "force-dynamic";

export default async function AiPage() {
  const studio = await requireCmsStudioPage("/cms/ai", "ai", "manage_extensions");
  return <CmsStudio view="ai" initialStudio={studio} />;
}
