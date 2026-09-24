import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsStudioPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = { title: "Plugins — CMS Studio", description: "Install and manage portable CMS plugins." };
export const dynamic = "force-dynamic";

export default async function PluginsPage() {
  const studio = await requireCmsStudioPage("/cms/plugins", "plugins", "manage_extensions");
  return <CmsStudio view="plugins" initialStudio={studio} />;
}
