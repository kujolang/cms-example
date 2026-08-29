/* eslint-disable @next/next/no-html-link-for-pages */

import { IconArrowRight, IconLock, IconLogin2 } from "@tabler/icons-react";

const notices: Record<string, string> = {
  credentials: "The email or password is incorrect.",
  pending: "Your account is waiting for approval.",
  rejected: "This account registration was not approved.",
  suspended: "This account is suspended.",
  disabled: "Password login is not enabled for this site.",
  rate_limited: "Too many sign-in attempts. Try again in 15 minutes.",
};

export default function LoginForm({ returnTo, local, reason = "" }: { returnTo: string; local: boolean; reason?: string }) {

  return <main className="login-shell">
    <section className="login-card">
      <div className="login-mark"><IconLock size={24} stroke={1.7} /></div>
      <p className="eyebrow">Your publishing account</p>
      <h1>Sign in to Kujo CMS</h1>
      <p className="login-intro">Manage your profile or enter the editorial studio when your role includes publishing capabilities.</p>
      {local ? <>
        <form action="/api/cms/auth/login" method="post">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label><span>Email</span><input name="email" type="email" defaultValue="admin@fieldnotes.local" autoComplete="username" required /></label>
          <label><span>Password</span><input name="password" type="password" defaultValue="fieldnotes-demo" autoComplete="current-password" required /></label>
          <button className="button" type="submit"><IconLogin2 size={18} /><span>Sign in</span></button>
        </form>
        <div className="demo-accounts"><b>Local demonstration accounts</b><span>Administrator: admin@fieldnotes.local / fieldnotes-demo</span><span>Editor: editor@fieldnotes.local / editor-demo</span></div>
        <p className="auth-switch">New here? <a href="/signup">Create an account</a></p>
      </> : <a className="button hosted-login" href={`/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`}><span>Sign in with ChatGPT</span><IconArrowRight size={18} /></a>}
      <p className="login-notice" aria-live="polite">{notices[reason] ?? ""}</p>
      <a className="login-back" href="/">View the public publication</a>
    </section>
  </main>;
}
