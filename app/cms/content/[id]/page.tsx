import type { Metadata } from "next";
import CmsStudio from "../../CmsStudio";

export const metadata: Metadata = {
  title: "Edit content — CMS Studio",
  description: "Edit content, publishing, taxonomy, SEO, and sharing settings.",
};

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CmsStudio view="edit" entryId={Number(id)} />;
}
