import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "SEO & sharing — CMS Studio",
  description: "Review search and social metadata across CMS content.",
};

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const initialUser = await requireCmsPage("/cms/seo");
  return <CmsStudio view="seo" initialUser={initialUser} />;
}
