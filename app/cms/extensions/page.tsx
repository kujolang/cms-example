import { redirect } from "next/navigation";
import { requireCmsPage } from "../../../lib/cms-page-auth";

export const dynamic = "force-dynamic";

export default async function ExtensionsPage() {
  await requireCmsPage("/cms/extensions", "manage_extensions");
  redirect("/cms/themes");
}
