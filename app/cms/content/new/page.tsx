import type { Metadata } from "next";
import CmsStudio from "../../CmsStudio";
import { requireCmsPage } from "../../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "New content — CMS Studio",
  description: "Create a page or article in Kujo CMS.",
};

export const dynamic = "force-dynamic";

export default async function NewContentPage() {
  await requireCmsPage("/cms/content/new");
  return <CmsStudio view="new" />;
}
