import CmsStudio from "../../CmsStudio";
import { requireCmsPage } from "../../../../lib/cms-page-auth";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCmsPage(`/cms/users/${id}`, "manage_users");
  return <CmsStudio view="userEdit" userId={Number(id)} />;
}
