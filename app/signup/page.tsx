import type { Metadata } from "next";
import { getRegistrationSettings } from "../../lib/cms-user-store";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create an account — Field Notes",
  description: "Join the Field Notes community and create your publishing profile.",
};

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const registration = await getRegistrationSettings().catch(() => ({ mode: "closed" as const, default_role: "subscriber" }));
  return <SignupForm mode={registration.mode} />;
}
