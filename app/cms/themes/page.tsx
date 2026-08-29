import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = { title: "Themes — CMS Studio", description: "Install and manage portable CMS themes." };
export const dynamic = "force-dynamic";

export default async function ThemesPage() {
  const initialUser = await requireCmsPage("/cms/themes", "manage_extensions");
  return <CmsStudio view="themes" initialUser={initialUser} />;
}
