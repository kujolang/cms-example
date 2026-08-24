import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";

export const metadata: Metadata = {
  title: "SEO & sharing — CMS Studio",
  description: "Review search and social metadata across CMS content.",
};

export default function SeoPage() {
  return <CmsStudio view="seo" />;
}
