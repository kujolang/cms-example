import type { Metadata } from "next";
import CmsStudio from "../../CmsStudio";
import { requireCmsPage } from "../../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "Edit content — CMS Studio",
  description: "Edit content, publishing, taxonomy, SEO, and sharing settings.",
};

export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCmsPage(`/cms/content/${id}`);
  return <CmsStudio view="edit" entryId={Number(id)} />;
}
