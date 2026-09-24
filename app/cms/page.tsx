import type { Metadata } from "next";
import CmsStudio from "./CmsStudio";
import { requireCmsStudioPage } from "../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "CMS Dashboard",
  description: "Manage the Field Notes publication through Kujo CMS.",
};

export const dynamic = "force-dynamic";

export default async function CmsConsole() {
  const studio = await requireCmsStudioPage("/cms", "dashboard");
  return <CmsStudio view="dashboard" initialStudio={studio} />;
}
