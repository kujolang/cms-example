import type { Metadata } from "next";
import CmsStudio from "../../CmsStudio";

export const metadata: Metadata = {
  title: "New content — CMS Studio",
  description: "Create a page or article in Kujo CMS.",
};

export default function NewContentPage() {
  return <CmsStudio view="new" />;
}
