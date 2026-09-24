import type { Metadata } from "next";
import CmsStudio from "../../CmsStudio";
import { requireCmsStudioPage } from "../../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "New content — CMS Studio",
  description: "Create a page or article in Kujo CMS.",
};

export const dynamic = "force-dynamic";

export default async function NewContentPage() {
  const studio = await requireCmsStudioPage("/cms/content/new", "new");
  return <CmsStudio view="new" initialStudio={studio} />;
}
