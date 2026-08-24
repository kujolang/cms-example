import type { Metadata } from "next";
import CmsStudio from "./CmsStudio";

export const metadata: Metadata = {
  title: "CMS Dashboard",
  description: "Manage the Field Notes publication through Kujo CMS.",
};

export default function CmsConsole() {
  return <CmsStudio view="dashboard" />;
}
