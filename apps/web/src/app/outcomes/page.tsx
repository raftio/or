"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api";

type OutcomeRecord = {
  id?: string;
  release_id: string;
  kpi_id?: string;
  metric_name?: string;
  value: number;
  unit?: string;
  timestamp: string;
};

type ByRelease = {
  releaseId: string;
  outcomes: OutcomeRecord[];
  ticket_ids?: string[];
};

type ByTicket = {
  ticketId: string;
  releases: { releaseId: string; outcomes: OutcomeRecord[] }[];
};

export default function OutcomesPage() {
  const [mode, setMode] = useState<"release" | "ticket">("release");
  const [releaseId, setReleaseId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [data, setData] = useState<ByRelease | ByTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadByRelease() {
    if (!releaseId.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetchJson<ByRelease>(
        `/v1/outcomes?releaseId=${encodeURIComponent(releaseId.trim())}`
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function loadByTicket() {
    if (!ticketId.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetchJson<ByTicket>(
        `/v1/outcomes?ticketId=${encodeURIComponent(ticketId.trim())}`
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Outcomes</h1>
      <p className="text-gray-600">
        View outcome records by release or by ticket (releases that include this
        ticket).
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => setMode("release")}
          className={`rounded px-3 py-1.5 ${
            mode === "release"
              ? "bg-blue-600 text-white"
              : "border border-gray-300 bg-gray-50"
          }`}
        >
          By release
        </button>
        <button
          onClick={() => setMode("ticket")}
          className={`rounded px-3 py-1.5 ${
            mode === "ticket"
              ? "bg-blue-600 text-white"
              : "border border-gray-300 bg-gray-50"
          }`}
        >
          By ticket
        </button>
      </div>
      {mode === "release" && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Release ID (e.g. org/repo:v1.0.0)"
            value={releaseId}
            onChange={(e) => setReleaseId(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <button
            onClick={loadByRelease}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      )}
      {mode === "ticket" && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ticket ID"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <button
            onClick={loadByTicket}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      )}
      {error && (
        <p className="rounded bg-red-100 p-2 text-red-800">{error}</p>
      )}
      {data && "releaseId" in data && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Release: {(data as ByRelease).releaseId}</h2>
          {(data as ByRelease).ticket_ids?.length ? (
            <p className="text-sm text-gray-600">
              Tickets: {(data as ByRelease).ticket_ids!.join(", ")}
            </p>
          ) : null}
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-2">Metric / KPI</th>
                <th className="py-1 pr-2">Value</th>
                <th className="py-1">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {(data as ByRelease).outcomes.map((o, i) => (
                <tr key={o.id ?? i} className="border-b">
                  <td className="py-1 pr-2">
                    {o.metric_name ?? o.kpi_id ?? "—"}
                  </td>
                  <td className="py-1 pr-2">
                    {o.value}
                    {o.unit ? ` ${o.unit}` : ""}
                  </td>
                  <td className="py-1 text-gray-600">{o.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {data && "ticketId" in data && (
        <section className="space-y-4">
          <h2 className="font-semibold">
            Ticket: {(data as ByTicket).ticketId}
          </h2>
          {(data as ByTicket).releases.map((r) => (
            <div
              key={r.releaseId}
              className="rounded border bg-white p-4"
            >
              <h3 className="font-medium text-gray-800">{r.releaseId}</h3>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-2">Metric / KPI</th>
                    <th className="py-1 pr-2">Value</th>
                    <th className="py-1">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {r.outcomes.map((o, i) => (
                    <tr key={o.id ?? i} className="border-b">
                      <td className="py-1 pr-2">
                        {o.metric_name ?? o.kpi_id ?? "—"}
                      </td>
                      <td className="py-1 pr-2">
                        {o.value}
                        {o.unit ? ` ${o.unit}` : ""}
                      </td>
                      <td className="py-1 text-gray-600">{o.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
