"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState } from "react";
import { IconArrowRight, IconLock, IconLogin2 } from "@tabler/icons-react";

export default function LoginForm({ returnTo, local }: { returnTo: string; local: boolean }) {
  const [email, setEmail] = useState("admin@fieldnotes.local");
  const [password, setPassword] = useState("fieldnotes-demo");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("Signing in…");
    try {
      const response = await fetch("/api/cms/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email, password }) });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Sign-in failed.");
      window.location.assign(returnTo);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  return <main className="login-shell">
    <section className="login-card">
      <div className="login-mark"><IconLock size={24} stroke={1.7} /></div>
      <p className="eyebrow">Your publishing account</p>
      <h1>Sign in to Kujo CMS</h1>
      <p className="login-intro">Manage your profile or enter the editorial studio when your role includes publishing capabilities.</p>
      {local ? <>
        <form onSubmit={submit}>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          <button className="button" type="submit" disabled={busy}><IconLogin2 size={18} /> <span>{busy ? "Signing in…" : "Sign in"}</span></button>
        </form>
        <div className="demo-accounts"><b>Local demonstration accounts</b><span>Administrator: admin@fieldnotes.local / fieldnotes-demo</span><span>Editor: editor@fieldnotes.local / editor-demo</span></div>
        <p className="auth-switch">New here? <a href="/signup">Create an account</a></p>
      </> : <a className="button hosted-login" href={`/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`}><span>Sign in with ChatGPT</span><IconArrowRight size={18} /></a>}
      <p className="login-notice" aria-live="polite">{notice}</p>
      <a className="login-back" href="/">View the public publication</a>
    </section>
  </main>;
}
