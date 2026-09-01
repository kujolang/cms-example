"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCheck, IconCodeDots, IconLock, IconPlugConnected, IconShieldCheck } from "@tabler/icons-react";

type Ability = { name: string; label: string; description: string; category: string; permission: string; enabled: boolean; manageable: boolean; source: string; source_name?: string; definition_digest: string; definition: { id: string; version: string; idempotency: { mode: "intrinsic" | "keyed" | "none" } }; annotations: { readonly: boolean; destructive: boolean; idempotent: boolean; requires_confirmation: boolean } };
type Connector = { key: string; label: string; purpose: string; mode: string; configured: boolean; enabled: boolean; manageable: boolean; source: string; source_name?: string; status: string; approval_required: boolean; secret_storage: string };
type AiControlPlane = {
  abilities: { items: Ability[]; count: number };
  connectors: { items: Connector[]; count: number; secrets_exposed: boolean };
  mcp: { tools: unknown[]; count: number; protocol: string };
  webmcp: { enabled: boolean; automatic: boolean; tools: unknown[]; security: { published_only: boolean; read_only: boolean } };
  extensions: { abilities: Array<Record<string, unknown>>; connectors: Array<Record<string, unknown>>; counts: { abilities: number; connectors: number } };
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
  const [mutating, setMutating] = useState("");
  const [health, setHealth] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    loadControlPlane().then((next) => { if (active) setData(next); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "AI control plane is unavailable."); });
    return () => { active = false; };
  }, [refreshKey]);
  const writeAbilities = useMemo(() => data?.abilities.items.filter((ability) => !ability.annotations.readonly).length ?? 0, [data]);
  const mcpConnector = useMemo(() => data?.connectors.items.find((connector) => connector.key === "mcp"), [data]);
  const abilities = data?.abilities.items ?? [];
  const connectors = data?.connectors.items ?? [];

  const setFeatureState = async (type: "ability" | "connector", key: string, enabled: boolean) => {
    setMutating(`${type}:${key}`);
    setError("");
    try {
      const response = await fetch("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(type === "ability" ? { action: "setAbilityState", name: key, enabled } : { action: "setConnectorState", key, enabled }) });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? `Could not update ${type}.`);
      setData(await loadControlPlane());
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Could not update ${type}.`); }
    finally { setMutating(""); }
  };

  const checkHealth = async (key: string) => {
    setMutating(`health:${key}`);
    setError("");
    try {
      const response = await fetch("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkConnectorHealth", key }) });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Connector health check failed.");
      setHealth((current) => ({ ...current, [key]: "Healthy now" }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Connector health check failed.";
      setHealth((current) => ({ ...current, [key]: message }));
    } finally { setMutating(""); }
  };

  return <div className="ai-workspace">
    {error && <p className="ai-error" role="alert">{error}</p>}
    <section className="ai-panel ai-access-panel"><div className="panel-heading"><div><p className="eyebrow">Access surfaces</p><h2>One capability system, every agent path</h2></div><span>{writeAbilities} approval-gated write actions</span></div><div className="ai-access-grid"><article><b>REST API</b><strong>All {data?.abilities.count ?? 0} abilities</strong><p>Canonical discovery, exact schemas, scoped execution, one-time approvals, and durable receipts.</p><code>/v1/abilities</code></article><article><b>CLI</b><strong>All {data?.abilities.count ?? 0} abilities</strong><p>The terminal wrapper discovers, approves, and runs the same registry through the API.</p><code>scripts/cms-ai.sh</code></article><article><b>MCP</b><strong>{data?.mcp.count ?? 0} mapped tools</strong><p>Every ability has a digest-bound tool descriptor. A configured MCP server supplies the authenticated transport.</p><code>{mcpConnector?.configured ? "Connector configured" : "Connector ready to configure"}</code></article><article><b>WebMCP</b><strong>{data?.webmcp.tools.length ?? 0} public tools</strong><p>Enabled by default for bounded, published, read-only browser access. It cannot widen protected Ability execution.</p><code>{data?.webmcp.enabled ? "Enabled automatically" : "Disabled by configuration"}</code></article></div></section>
    <section className="ai-panel"><div className="panel-heading"><div><p className="eyebrow">Abilities API</p><h2>Agent-accessible CMS operations</h2><p>Disable an operation to remove it from execution and MCP discovery. Plugin abilities follow their plugin’s activation state and execute in that declared runtime.</p></div><span>{abilities.filter((ability) => ability.enabled).length}/{abilities.length} active</span></div><div className="ability-list">{abilities.map((ability) => <article className={!ability.enabled ? "disabled" : ""} key={`${ability.source}:${ability.name}`}><div className="ability-icon">{ability.annotations.readonly ? <IconCodeDots size={20} /> : <IconLock size={20} />}</div><div><code>{ability.name}</code><h3>{ability.label}</h3><p>{ability.description}</p><small>{ability.definition.id}@{ability.definition.version} · digest {ability.definition_digest.slice(0, 12)}</small><div className="ability-tags"><span>{ability.category}</span><span>{ability.permission}</span>{ability.annotations.readonly ? <span>Read only</span> : <span>Write</span>}{ability.annotations.requires_confirmation && <span>One-time approval</span>}{ability.definition.idempotency.mode === "keyed" && <span>Keyed replay</span>}{ability.source === "plugin" && <span>{ability.source_name}</span>}</div></div><button type="button" className={`feature-toggle ${ability.enabled ? "enabled" : ""}`} disabled={!ability.manageable || mutating === `ability:${ability.name}`} onClick={() => void setFeatureState("ability", ability.name, !ability.enabled)} aria-pressed={ability.enabled}><span>{ability.manageable ? (ability.enabled ? "On" : "Off") : "Plugin managed"}</span><i /></button></article>)}</div></section>
    <section className="ai-panel"><div className="panel-heading"><div><p className="eyebrow">Kujo ecosystem</p><h2>Connectors</h2><p>Configure endpoints on the server, then activate, deactivate, or verify them here. Active plugins may contribute their own connector descriptors.</p></div><span><IconLock size={15} /> Secrets stay external</span></div><div className="connector-grid">{connectors.map((connector) => <article key={`${connector.source}:${connector.key}`} className={connector.enabled ? "configured" : ""}><div className="connector-heading"><span>{connector.enabled ? <IconCheck size={18} /> : <IconPlugConnected size={18} />}</span><div><h3>{connector.label}</h3><code>{connector.mode}</code></div><em>{connector.enabled ? "Active" : connector.configured ? "Inactive" : "Needs setup"}</em></div><p>{connector.purpose}</p><small>{connector.approval_required ? "Approval-gated effects" : "Policy-scoped integration"} · {connector.secret_storage}</small><div className="connector-actions"><button type="button" className={`feature-toggle ${connector.enabled ? "enabled" : ""}`} disabled={!connector.manageable || (!connector.configured && !connector.enabled) || mutating === `connector:${connector.key}`} onClick={() => void setFeatureState("connector", connector.key, !connector.enabled)} aria-pressed={connector.enabled}><span>{connector.manageable ? (connector.enabled ? "Active" : connector.configured ? "Inactive" : "Configure server first") : "Plugin managed"}</span><i /></button><button type="button" className="connector-health" disabled={!connector.configured || mutating === `health:${connector.key}`} onClick={() => void checkHealth(connector.key)}>Check health</button></div>{health[connector.key] && <output className="connector-health-result">{health[connector.key]}</output>}</article>)}</div></section>
    <section className="ai-safety-panel"><IconShieldCheck size={24} /><div><h3>Production safety defaults</h3><p>Abilities are namespaced, versioned, digest-bound, bearer-authenticated, permission-scoped, rate-limited, and audited. Mutations require a short-lived approval bound to one exact invocation and keyed writes return replay-safe receipts. Connector endpoints are configured through server environment variables and are never returned to the browser.</p></div></section>
  </div>;
}
