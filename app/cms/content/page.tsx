import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsStudioPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "Content — CMS Studio",
  description: "Browse and manage CMS content without opening the editor.",
};

export const dynamic = "force-dynamic";

export default async function ContentListPage() {
  const studio = await requireCmsStudioPage("/cms/content", "content");
  return <CmsStudio view="content" initialStudio={studio} />;
}
