import type { Metadata } from "next";
import CmsStudio from "../CmsStudio";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const metadata: Metadata = {
  title: "Users & roles — CMS Studio",
  description: "Review CMS identities, roles, and editorial capabilities.",
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireCmsPage("/cms/users", "manage_users");
  return <CmsStudio view="users" />;
}
