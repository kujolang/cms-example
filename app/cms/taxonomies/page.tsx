import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";

export const metadata: Metadata = {
  title: "Taxonomies — CMS Studio",
  description: "Manage CMS taxonomies and terms.",
};

export default function TaxonomiesPage() {
  return <CmsStudio view="taxonomies" />;
}
