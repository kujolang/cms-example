import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";

export const metadata: Metadata = {
  title: "Content — CMS Studio",
  description: "Browse and manage CMS content without opening the editor.",
};

export default function ContentListPage() {
  return <CmsStudio view="content" />;
}
