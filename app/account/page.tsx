import type { Metadata } from "next";
import { requireAccountPage } from "../../lib/cms-page-auth";
import AccountProfile from "./AccountProfile";

export const metadata: Metadata = { title: "Your account — Field Notes" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireAccountPage();
  return <AccountProfile user={user} />;
}
