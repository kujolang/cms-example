import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsStudioPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = { title: "Themes — CMS Studio", description: "Install and manage portable CMS themes." };
export const dynamic = "force-dynamic";

export default async function ThemesPage() {
  const studio = await requireCmsStudioPage("/cms/themes", "themes", "manage_extensions");
  return <CmsStudio view="themes" initialStudio={studio} />;
}
