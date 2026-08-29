"use client";

import { useState, useSyncExternalStore } from "react";
import { IconBrandBluesky, IconBrandFacebook, IconBrandLinkedin, IconBrandReddit, IconBrandWhatsapp, IconBrandX, IconMail, IconSend } from "@tabler/icons-react";

const icons = { x: IconBrandX, linkedin: IconBrandLinkedin, facebook: IconBrandFacebook, bluesky: IconBrandBluesky, reddit: IconBrandReddit, whatsapp: IconBrandWhatsapp, email: IconMail };
const subscribeToLocation = () => () => {};

export function ShareLinks({ title, networks, accounts = {} }: { title: string; networks: string[]; accounts?: Record<string, string> }) {
  const url = useSyncExternalStore(subscribeToLocation, () => window.location.href, () => "");
  const xAccount = (accounts.x ?? "").replace(/^@+/, "");
  const blueskyAccount = (accounts.bluesky ?? "").replace(/^@+/, "");
  const links: Record<string, string> = {
    x: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}${xAccount ? `&via=${encodeURIComponent(xAccount)}` : ""}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    bluesky: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}${blueskyAccount ? ` via @${blueskyAccount}` : ""}`)}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  };
  return <aside className="share-links" aria-label="Share this article"><p>Share this article</p><div>{networks.map((network) => { const Icon = icons[network as keyof typeof icons]; return Icon ? <a href={links[network]} target={network === "email" ? undefined : "_blank"} rel="noreferrer" aria-label={`Share via ${network}`} key={network}><Icon size={20} stroke={1.7} /></a> : null; })}</div></aside>;
}

export function NewsletterBox() {
  const [submitted, setSubmitted] = useState(false);
  return <aside className="newsletter-box"><div><p className="eyebrow">Field Notes, occasionally</p><h2>Useful ideas, delivered without the noise.</h2><p>Get new essays about content systems, agentic workflows, and dependable software.</p></div><form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><label><span className="sr-only">Email address</span><input type="email" required placeholder="you@example.com" /></label><button type="submit"><IconSend size={18} /> Subscribe</button><small>{submitted ? "Demo signup captured—connect your preferred email provider here." : "No spam. Replace this demo action with your newsletter provider."}</small></form></aside>;
}
