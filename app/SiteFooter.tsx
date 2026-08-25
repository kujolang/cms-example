/* eslint-disable @next/next/no-html-link-for-pages */
export default function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-brand"><a className="wordmark" href="/">KUJO / FIELD NOTES</a><p>Ideas and practical patterns for building software with clarity, context, and control.</p></div>
    <div className="footer-column"><h2>Browse</h2><a href="/articles">All articles</a><a href="/#articles">Latest notes</a><a href="/cms">CMS console</a></div>
    <div className="footer-column"><h2>Company</h2><a href="/pages/about">About</a><a href="/pages/principles">Principles</a><a href="/articles/markdown-field-guide">Markdown field guide</a></div>
    <div className="footer-column"><h2>Contact</h2><a href="mailto:hello@example.com">Email</a><a href="https://x.com/kujolang">X</a><a href="https://github.com/kujolang">GitHub</a></div>
    <p className="footer-meta">Content delivered by Kujo CMS. Presentation stays yours.</p>
  </footer>;
}
