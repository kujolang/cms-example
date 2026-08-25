"use client";
import { useState } from "react";
import { IconArrowRight, IconUserPlus } from "@tabler/icons-react";

export default function SignupForm({ mode }: { mode: "open" | "approval" | "closed" }) {
  const [form, setForm] = useState({ display_name: "", username: "", email: "", password: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("Creating your account…");
    try {
      const response = await fetch("/api/cms/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signup", ...form }) });
      const payload = await response.json() as { ok: boolean; data?: { pending?: boolean; message?: string }; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Account creation failed.");
      if (payload.data?.pending) {
        setComplete(true);
        setNotice(payload.data.message ?? "Your account is waiting for approval.");
      } else {
        window.location.assign("/account?welcome=1");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Account creation failed.");
      setBusy(false);
    }
  };

  return <main className="login-shell">
    <section className="login-card signup-card">
      <div className="login-mark"><IconUserPlus size={24} stroke={1.7} /></div>
      <p className="eyebrow">Join Field Notes</p>
      <h1>{complete ? "Account created" : "Create your account"}</h1>
      <p className="login-intro">{mode === "open" ? "Your account will be ready as soon as you sign up." : mode === "approval" ? "Create your profile now. An administrator will approve access before your first sign-in." : "New account registration is not currently available."}</p>
      {mode !== "closed" && !complete && <form onSubmit={submit}>
        <label><span>Display name</span><input value={form.display_name} onChange={(event) => update("display_name", event.target.value)} autoComplete="name" required /></label>
        <label><span>Username</span><input value={form.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" minLength={3} required /></label>
        <label><span>Email</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></label>
        <label><span>Password</span><input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" minLength={10} required /></label>
        <small className="field-help">Use at least 10 characters.</small>
        <button className="button" type="submit" disabled={busy}><IconUserPlus size={18} /><span>{busy ? "Creating account…" : "Create account"}</span></button>
      </form>}
      <p className="login-notice" aria-live="polite">{notice}</p>
      <a className="login-back auth-arrow" href="/cms/login"><span>Already have an account? Sign in</span><IconArrowRight size={16} /></a>
    </section>
  </main>;
}
