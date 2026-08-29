import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = { title: "Themes & plugins — CMS Studio", description: "Install and manage portable CMS themes and plugins." };
export const dynamic = "force-dynamic";

export default async function ExtensionsPage() {
  await requireCmsPage("/cms/extensions", "manage_extensions");
  return <CmsStudio view="extensions" />;
}
