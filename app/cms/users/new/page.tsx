import CmsStudio from "../../CmsStudio";
import { requireCmsStudioPage } from "../../../../lib/cms-page-auth";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const studio = await requireCmsStudioPage("/cms/users/new", "userNew", "manage_users");
  return <CmsStudio view="userNew" initialStudio={studio} />;
}
