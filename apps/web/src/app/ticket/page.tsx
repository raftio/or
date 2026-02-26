"use client";

import { useState } from "react";
import { fetchJson, apiUrl } from "@/lib/api";

type Context = {
  ticket_id: string;
  ticket_title: string;
  ticket_description: string;
  acceptance_criteria?: { id: string; description: string }[];
};

type Bundle = {
  id: string;
  version: number;
  ticket_ref: string;
  tasks: { id: string; title: string }[];
};

type State = { state: string; updated_at: string };

type EvidenceStatus = { complete: boolean; payloads: unknown[] };

export default function TicketPage() {
  const [ticketId, setTicketId] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  async function load() {
    if (!ticketId.trim()) return;
    setLoading(true);
    setError(null);
    setContext(null);
    setBundles(null);
    setState(null);
    setEvidenceStatus(null);
    try {
      const [ctxRes, bundlesRes, stateRes, evRes] = await Promise.allSettled([
        fetchJson<Context>(`/v1/context?ticketId=${encodeURIComponent(ticketId)}`),
        fetchJson<{ bundles: Bundle[] }>(`/v1/bundles?ticketId=${encodeURIComponent(ticketId)}`),
        fetchJson<State>(`/v1/state?ticketId=${encodeURIComponent(ticketId)}`).catch(() => null),
        fetchJson<EvidenceStatus>(`/v1/evidence/status?ticketId=${encodeURIComponent(ticketId)}`),
      ]);
      if (ctxRes.status === "fulfilled") setContext(ctxRes.value);
      if (bundlesRes.status === "fulfilled") setBundles(bundlesRes.value.bundles);
      if (stateRes.status === "fulfilled" && stateRes.value) setState(stateRes.value);
      if (evRes.status === "fulfilled") setEvidenceStatus(evRes.value);
      if (ctxRes.status === "rejected") setError(ctxRes.reason?.message ?? "Failed to load");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function buildBundle() {
    if (!ticketId.trim()) return;
    setBuilding(true);
    setError(null);
    try {
      await fetch(apiUrl("/v1/bundles"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_ref: ticketId.trim(),
          build_from_ticket: true,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ticket</h1>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Ticket ID (e.g. PROJ-123)"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <button
          onClick={load}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load"}
        </button>
        <button
          onClick={buildBundle}
          disabled={building || !ticketId.trim()}
          className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {building ? "Building…" : "Build bundle"}
        </button>
      </div>
      {error && (
        <p className="rounded bg-red-100 p-2 text-red-800">{error}</p>
      )}
      {context && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Context</h2>
          <p className="text-gray-600">{context.ticket_title}</p>
          <p className="mt-1 text-sm text-gray-500">{context.ticket_description?.slice(0, 200)}…</p>
          {context.acceptance_criteria?.length ? (
            <ul className="mt-2 list-inside list-disc text-sm">
              {context.acceptance_criteria.map((ac) => (
                <li key={ac.id}>{ac.description}</li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
      {bundles != null && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Bundles ({bundles.length})</h2>
          <ul className="mt-2 space-y-2">
            {bundles.map((b) => (
              <li key={b.id} className="text-sm">
                {b.id} v{b.version} – {b.tasks.length} task(s)
              </li>
            ))}
          </ul>
        </section>
      )}
      {state && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">State</h2>
          <p className="text-gray-700">{state.state}</p>
          <p className="text-xs text-gray-500">{state.updated_at}</p>
        </section>
      )}
      {evidenceStatus != null && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Evidence</h2>
          <p className={evidenceStatus.complete ? "text-green-600" : "text-amber-600"}>
            {evidenceStatus.complete ? "Complete" : "Incomplete"} ({evidenceStatus.payloads.length} payloads)
          </p>
        </section>
      )}
    </div>
  );
}
