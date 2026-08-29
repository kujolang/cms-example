import CmsStudio from "../../CmsStudio";
import { requireCmsPage } from "../../../../lib/cms-page-auth";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const initialUser = await requireCmsPage("/cms/users/new", "manage_users");
  return <CmsStudio view="userNew" initialUser={initialUser} />;
}
