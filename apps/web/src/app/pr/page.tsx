"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api";

type RiskFlag = { code: string; severity?: string; detail?: string };

type EvidenceValidation = {
  status: string;
  total_ac: number;
  evidence_count: number;
};

type PrIntelligence = {
  summary: string;
  risk_flags: RiskFlag[];
  evidence_validation: EvidenceValidation;
};

export default function PRPage() {
  const [repo, setRepo] = useState("");
  const [prId, setPrId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [data, setData] = useState<PrIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!repo.trim() || !prId.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ repo: repo.trim(), prId: prId.trim() });
      if (ticketId.trim()) params.set("ticketId", ticketId.trim());
      const res = await fetchJson<PrIntelligence>(`/v1/pr-intelligence?${params}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">PR Intelligence</h1>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Repo (owner/repo)"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="PR number"
          value={prId}
          onChange={(e) => setPrId(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Ticket ID (optional)"
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
      </div>
      {error && (
        <p className="rounded bg-red-100 p-2 text-red-800">{error}</p>
      )}
      {data && (
        <div className="space-y-4">
          <section className="rounded border bg-white p-4">
            <h2 className="font-semibold">Summary</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-700">{data.summary}</pre>
          </section>
          <section className="rounded border bg-white p-4">
            <h2 className="font-semibold">Risk flags</h2>
            {data.risk_flags.length === 0 ? (
              <p className="text-gray-500">None</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-sm">
                {data.risk_flags.map((f, i) => (
                  <li key={i}>
                    {f.code} {f.detail && `– ${f.detail}`}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded border bg-white p-4">
            <h2 className="font-semibold">Evidence validation</h2>
            <p className="text-gray-700">
              Status: {data.evidence_validation.status} | Total AC:{" "}
              {data.evidence_validation.total_ac} | Evidence count:{" "}
              {data.evidence_validation.evidence_count}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
