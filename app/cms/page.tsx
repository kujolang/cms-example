import type { Metadata } from "next";
import CmsStudio from "./CmsStudio";

export const metadata: Metadata = {
  title: "CMS Studio",
  description: "Create, edit, categorize, optimize, and publish content through Kujo CMS.",
};

export default function CmsConsole() {
  return <CmsStudio />;
}
