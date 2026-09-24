import CmsStudio from "../../CmsStudio";
import { requireCmsStudioPage } from "../../../../lib/cms-page-auth";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const studio = await requireCmsStudioPage(`/cms/users/${id}`, "userEdit", "manage_users");
  return <CmsStudio view="userEdit" userId={Number(id)} initialStudio={studio} />;
}
