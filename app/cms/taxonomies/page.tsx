import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "Taxonomies — CMS Studio",
  description: "Manage CMS taxonomies and terms.",
};

export const dynamic = "force-dynamic";

export default async function TaxonomiesPage() {
  await requireCmsPage("/cms/taxonomies");
  return <CmsStudio view="taxonomies" />;
}
