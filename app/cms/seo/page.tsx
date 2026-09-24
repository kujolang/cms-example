import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsStudioPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "SEO & sharing — CMS Studio",
  description: "Review search and social metadata across CMS content.",
};

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const studio = await requireCmsStudioPage("/cms/seo", "seo");
  return <CmsStudio view="seo" initialStudio={studio} />;
}
