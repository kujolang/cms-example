import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = { title: "Plugins — CMS Studio", description: "Install and manage portable CMS plugins." };
export const dynamic = "force-dynamic";

export default async function PluginsPage() {
  await requireCmsPage("/cms/plugins", "manage_extensions");
  return <CmsStudio view="plugins" />;
}
