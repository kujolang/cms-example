import type { Metadata } from "next";
import CmsStudio from "./CmsStudio";
import { requireCmsPage } from "../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "CMS Dashboard",
  description: "Manage the Field Notes publication through Kujo CMS.",
};

export const dynamic = "force-dynamic";

export default async function CmsConsole() {
  const initialUser = await requireCmsPage("/cms");
  return <CmsStudio view="dashboard" initialUser={initialUser} />;
}
