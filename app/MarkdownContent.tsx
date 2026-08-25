"use client";

import { Fragment, useState, type ReactNode } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={index} href={link[2]}>{link[1]}</a>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function highlighted(code: string) {
  const tokens = code.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|for|await|async|import|from|export|true|false|null|class|new|try|catch)\b|\/\/.*$|\b\d+(?:\.\d+)?\b)/gm);
  return tokens.map((token, index) => {
    const className = /^['"]/.test(token) ? "tok-string" : /^\/\//.test(token) ? "tok-comment" : /^\d/.test(token) ? "tok-number" : /^(const|let|var|function|return|if|else|for|await|async|import|from|export|true|false|null|class|new|try|catch)$/.test(token) ? "tok-keyword" : "";
    return className ? <span className={className} key={index}>{token}</span> : <Fragment key={index}>{token}</Fragment>;
  });
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <figure className="code-block"><figcaption><span>{language || "text"}</span><button type="button" onClick={() => void copy()} aria-label="Copy code">{copied ? <IconCheck size={17} /> : <IconCopy size={17} />}<span>{copied ? "Copied" : "Copy"}</span></button></figcaption><pre><code>{highlighted(code)}</code></pre></figure>;
}

export default function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim(); const code: string[] = []; index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) { code.push(lines[index]); index += 1; }
      nodes.push(<CodeBlock code={code.join("\n")} language={language} key={`code-${index}`} />); index += 1; continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { const level = Math.min(6, heading[1].length + 1); const Tag = `h${level}` as keyof React.JSX.IntrinsicElements; nodes.push(<Tag key={index}>{inline(heading[2])}</Tag>); index += 1; continue; }
    if (/^>\s?/.test(line)) { const quote: string[] = []; while (index < lines.length && /^>\s?/.test(lines[index])) { quote.push(lines[index].replace(/^>\s?/, "")); index += 1; } nodes.push(<blockquote key={`q-${index}`}>{inline(quote.join(" "))}</blockquote>); continue; }
    if (/^[-*]\s+/.test(line)) { const items: string[] = []; while (index < lines.length && /^[-*]\s+/.test(lines[index])) { items.push(lines[index].replace(/^[-*]\s+/, "")); index += 1; } nodes.push(<ul key={`ul-${index}`}>{items.map((item) => <li key={item}>{inline(item)}</li>)}</ul>); continue; }
    if (/^\d+\.\s+/.test(line)) { const items: string[] = []; while (index < lines.length && /^\d+\.\s+/.test(lines[index])) { items.push(lines[index].replace(/^\d+\.\s+/, "")); index += 1; } nodes.push(<ol key={`ol-${index}`}>{items.map((item) => <li key={item}>{inline(item)}</li>)}</ol>); continue; }
    if (/^---+$/.test(line)) { nodes.push(<hr key={index} />); index += 1; continue; }
    const paragraph = [line]; index += 1; while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|>\s?|[-*]\s+|\d+\.\s+|---+$)/.test(lines[index])) { paragraph.push(lines[index]); index += 1; }
    nodes.push(<p key={`p-${index}`}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="article-body">{nodes}</div>;
}
