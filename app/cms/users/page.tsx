import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsStudioPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "Users & roles — CMS Studio",
  description: "Review CMS identities, roles, and editorial capabilities.",
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const studio = await requireCmsStudioPage("/cms/users", "users", "manage_users");
  return <CmsStudio view="users" initialStudio={studio} />;
}
