import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "Content — CMS Studio",
  description: "Browse and manage CMS content without opening the editor.",
};

export const dynamic = "force-dynamic";

export default async function ContentListPage() {
  const initialUser = await requireCmsPage("/cms/content");
  return <CmsStudio view="content" initialUser={initialUser} />;
}
