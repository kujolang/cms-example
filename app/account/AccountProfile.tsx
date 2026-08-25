"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useState } from "react";
import { IconDeviceFloppy, IconExternalLink, IconKey, IconLogout, IconUser } from "@tabler/icons-react";
import type { StudioUser } from "../../lib/cms-auth";

export default function AccountProfile({ user }: { user: StudioUser }) {
  const [profile, setProfile] = useState({ display_name: user.name, first_name: user.firstName, last_name: user.lastName, bio: user.bio, website_url: user.websiteUrl, avatar_url: user.avatarUrl, x: user.social.x ?? "", linkedin: user.social.linkedin ?? "", github: user.social.github ?? "" });
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canEnterStudio = user.capabilities.includes("view_content");

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("Saving your profile…");
    const response = await fetch("/api/cms/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateProfile", ...profile, social: { x: profile.x, linkedin: profile.linkedin, github: profile.github } }) });
    const payload = await response.json() as { ok: boolean; error?: string };
    setNotice(response.ok && payload.ok ? "Profile saved." : payload.error ?? "Profile could not be saved."); setBusy(false);
  };
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("Updating your password…");
    const response = await fetch("/api/cms/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "changePassword", current_password: passwords.current, password: passwords.next }) });
    const payload = await response.json() as { ok: boolean; error?: string };
    if (response.ok && payload.ok) setPasswords({ current: "", next: "" });
    setNotice(response.ok && payload.ok ? "Password updated." : payload.error ?? "Password could not be updated."); setBusy(false);
  };
  const logout = async () => { await fetch("/api/cms/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); window.location.assign("/"); };

  return <main className="account-shell">
    <header className="account-header"><a className="wordmark" href="/">KUJO / FIELD NOTES</a><nav>{canEnterStudio && <a href="/cms">CMS Studio <IconExternalLink size={16} /></a>}<button type="button" onClick={() => void logout()}><IconLogout size={17} /> Sign out</button></nav></header>
    <section className="account-hero"><div className="account-avatar-large">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <IconUser size={32} />}</div><div><p className="eyebrow">Your account</p><h1>{user.name}</h1><p>@{user.username} · {user.role}</p></div></section>
    <p className="studio-notice" aria-live="polite">{notice || "Update the public details attached to your account."}</p>
    <div className="account-grid">
      <form className="account-panel" onSubmit={saveProfile}><div><p className="eyebrow">Profile</p><h2>Personal details</h2></div><div className="form-grid"><label className="wide"><span>Display name</span><input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} /></label><label><span>First name</span><input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} /></label><label><span>Last name</span><input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} /></label><label className="wide"><span>Biography</span><textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label><label className="wide"><span>Website</span><input type="url" value={profile.website_url} onChange={(e) => setProfile({ ...profile, website_url: e.target.value })} /></label><label className="wide"><span>Avatar URL</span><input type="url" value={profile.avatar_url} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })} /></label><label><span>X profile</span><input value={profile.x} onChange={(e) => setProfile({ ...profile, x: e.target.value })} /></label><label><span>LinkedIn</span><input value={profile.linkedin} onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })} /></label><label className="wide"><span>GitHub</span><input value={profile.github} onChange={(e) => setProfile({ ...profile, github: e.target.value })} /></label></div><button className="button" disabled={busy}><IconDeviceFloppy size={18} /> Save profile</button></form>
      <aside className="account-side"><section className="account-panel"><p className="eyebrow">Account</p><h2>Access</h2><dl><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Role</dt><dd>{user.role}</dd></div><div><dt>Status</dt><dd>{user.status}</dd></div></dl></section><form className="account-panel" onSubmit={changePassword}><IconKey size={20} /><h2>Change password</h2><label><span>Current password</span><input type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} autoComplete="current-password" /></label><label><span>New password</span><input type="password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} autoComplete="new-password" minLength={10} /></label><button className="button button-secondary" disabled={busy}>Update password</button></form></aside>
    </div>
  </main>;
}
