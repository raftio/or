"use client";

import { useState } from "react";
import { fetchJson, apiUrl } from "@/lib/api";

const EVENTS = [
  "ticket_created",
  "spec_ready",
  "dev_started",
  "pr_opened_or_updated",
  "evidence_validated",
  "validation_failed",
  "pr_merged",
  "metrics_collected",
  "feedback_applied",
] as const;

type StateResult = { state: string; updated_at: string };

type EventResult = {
  state: string;
  previous_state: string;
  transitioned: boolean;
};

export default function StatePage() {
  const [ticketId, setTicketId] = useState("");
  const [state, setState] = useState<StateResult | null>(null);
  const [eventResult, setEventResult] = useState<EventResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadState() {
    if (!ticketId.trim()) return;
    setLoading(true);
    setError(null);
    setState(null);
    setEventResult(null);
    try {
      const res = await fetchJson<StateResult>(
        `/v1/state?ticketId=${encodeURIComponent(ticketId)}`
      );
      setState(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "State not found");
    } finally {
      setLoading(false);
    }
  }

  async function emitEvent(event: string) {
    if (!ticketId.trim()) return;
    setSending(true);
    setError(null);
    setEventResult(null);
    try {
      const res = await fetch(apiUrl("/v1/state/events"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId.trim(),
          event,
          event_id: `evt-${Date.now()}-${event}`,
        }),
      });
      const data = (await res.json()) as EventResult;
      setEventResult(data);
      if (data.state) setState({ state: data.state, updated_at: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to emit event");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">State</h1>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Ticket ID"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <button
          onClick={loadState}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Loading…" : "Get state"}
        </button>
      </div>
      {error && (
        <p className="rounded bg-red-100 p-2 text-red-800">{error}</p>
      )}
      {state && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Current state</h2>
          <p className="text-lg text-gray-800">{state.state}</p>
          <p className="text-xs text-gray-500">{state.updated_at}</p>
        </section>
      )}
      {eventResult && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold">Last event result</h2>
          <p className="text-sm">
            {eventResult.previous_state} → {eventResult.state}{" "}
            {eventResult.transitioned ? "(transitioned)" : "(no-op)"}
          </p>
        </section>
      )}
      {ticketId.trim() && (
        <section className="rounded border bg-white p-4">
          <h2 className="font-semibold mb-2">Emit event</h2>
          <div className="flex flex-wrap gap-2">
            {EVENTS.map((ev) => (
              <button
                key={ev}
                onClick={() => emitEvent(ev)}
                disabled={sending}
                className="rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                {ev}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
