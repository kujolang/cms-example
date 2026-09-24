import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsStudioPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "Taxonomies — CMS Studio",
  description: "Manage CMS taxonomies and terms.",
};

export const dynamic = "force-dynamic";

export default async function TaxonomiesPage() {
  const studio = await requireCmsStudioPage("/cms/taxonomies", "taxonomies");
  return <CmsStudio view="taxonomies" initialStudio={studio} />;
}
