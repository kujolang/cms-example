"use client";

import { useEffect, useMemo, useState } from "react";
import { IconBolt, IconCheck, IconCodeDots, IconLock, IconPlugConnected, IconShieldCheck } from "@tabler/icons-react";

type Ability = { name: string; label: string; description: string; category: string; permission: string; annotations: { readonly: boolean; destructive: boolean; idempotent: boolean; requires_confirmation: boolean } };
type Connector = { key: string; label: string; purpose: string; mode: string; configured: boolean; status: string; approval_required: boolean; secret_storage: string };
type AiControlPlane = {
  abilities: { items: Ability[]; count: number };
  connectors: { items: Connector[]; count: number; secrets_exposed: boolean };
  mcp: { tools: unknown[]; count: number; protocol: string };
  webmcp: { enabled: boolean; automatic: boolean; tools: unknown[]; security: { published_only: boolean; read_only: boolean } };
};

async function loadControlPlane() {
  const response = await fetch("/api/cms?resource=ai", { cache: "no-store" });
  const payload = await response.json() as { ok: boolean; data?: AiControlPlane; error?: string };
  if (response.status === 401) { window.location.assign(`/cms/login?returnTo=${encodeURIComponent(window.location.pathname)}`); throw new Error("Sign in required."); }
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error ?? "AI control plane is unavailable.");
  return payload.data;
}

export default function AiWorkspace({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<AiControlPlane | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadControlPlane().then((next) => { if (active) setData(next); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "AI control plane is unavailable."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);
  const configured = useMemo(() => data?.connectors.items.filter((connector) => connector.configured).length ?? 0, [data]);
  const writeAbilities = useMemo(() => data?.abilities.items.filter((ability) => !ability.annotations.readonly).length ?? 0, [data]);
  const mcpConnector = useMemo(() => data?.connectors.items.find((connector) => connector.key === "mcp"), [data]);

  return <div className="ai-workspace">
    {error && <p className="ai-error" role="alert">{error}</p>}
    <section className={`ai-stat-grid ${loading ? "loading" : ""}`} aria-label="AI integration status"><article><IconBolt size={23} /><div><b>{data?.abilities.count ?? "—"}</b><span>Registered abilities</span></div></article><article><IconPlugConnected size={23} /><div><b>{configured}/{data?.connectors.count ?? "—"}</b><span>Connectors configured</span></div></article><article><IconCodeDots size={23} /><div><b>{data?.mcp.count ?? "—"}</b><span>MCP-ready tools</span></div></article><article><IconShieldCheck size={23} /><div><b>{data?.webmcp.tools.length ?? "—"}</b><span>WebMCP public tools</span></div></article></section>
    <section className="ai-panel ai-access-panel"><div className="panel-heading"><div><p className="eyebrow">Access surfaces</p><h2>One capability system, every agent path</h2></div><span>{writeAbilities} confirmed write actions</span></div><div className="ai-access-grid"><article><b>REST API</b><strong>All {data?.abilities.count ?? 0} abilities</strong><p>Discovery, schemas, scoped execution, confirmation, and audit receipts.</p><code>/v1/abilities</code></article><article><b>CLI</b><strong>All {data?.abilities.count ?? 0} abilities</strong><p>The terminal wrapper discovers and runs the same registry through the API.</p><code>scripts/cms-ai.sh</code></article><article><b>MCP</b><strong>{data?.mcp.count ?? 0} mapped tools</strong><p>Every ability has a tool descriptor. A configured MCP server supplies the authenticated transport.</p><code>{mcpConnector?.configured ? "Connector configured" : "Connector ready to configure"}</code></article><article><b>WebMCP</b><strong>{data?.webmcp.tools.length ?? 0} public tools</strong><p>Enabled by default for bounded, published, read-only browser access. Protected writes stay in the Abilities API.</p><code>{data?.webmcp.enabled ? "Enabled automatically" : "Disabled by configuration"}</code></article></div></section>
    <section className="ai-panel"><div className="panel-heading"><div><p className="eyebrow">Abilities API</p><h2>Agent-accessible CMS operations</h2></div><span>{data?.abilities.count ?? 0} registered</span></div><div className="ability-list">{data?.abilities.items.map((ability) => <article key={ability.name}><div className="ability-icon">{ability.annotations.readonly ? <IconCodeDots size={20} /> : <IconLock size={20} />}</div><div><code>{ability.name}</code><h3>{ability.label}</h3><p>{ability.description}</p><div className="ability-tags"><span>{ability.category}</span><span>{ability.permission}</span>{ability.annotations.readonly ? <span>Read only</span> : <span>Write</span>}{ability.annotations.requires_confirmation && <span>Confirmation required</span>}</div></div></article>)}</div></section>
    <section className="ai-panel"><div className="panel-heading"><div><p className="eyebrow">Kujo ecosystem</p><h2>Connectors</h2></div><span><IconLock size={15} /> Secrets stay external</span></div><div className="connector-grid">{data?.connectors.items.map((connector) => <article key={connector.key} className={connector.configured ? "configured" : ""}><div className="connector-heading"><span>{connector.configured ? <IconCheck size={18} /> : <IconPlugConnected size={18} />}</span><div><h3>{connector.label}</h3><code>{connector.mode}</code></div><em>{connector.configured ? "Configured" : "Available"}</em></div><p>{connector.purpose}</p><small>{connector.approval_required ? "Approval-gated effects" : "Policy-scoped integration"} · external secret storage</small></article>)}</div></section>
    <section className="ai-safety-panel"><IconShieldCheck size={24} /><div><h3>Production safety defaults</h3><p>Abilities are namespaced, schema-described, bearer-authenticated, permission-scoped, rate-limited, and audited. Mutating abilities require explicit confirmation. Connector endpoints are configured through server environment variables and are never returned to the browser.</p></div></section>
  </div>;
}
