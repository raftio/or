export function CicdCard() {
  return (
    <div className="rounded-xl border border-base-border bg-surface p-6 opacity-75 transition-shadow hover:shadow-md hover:shadow-glow/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f97316"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-base-text">CI/CD</h2>
        </div>
        <span className="rounded-full bg-base px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-base-text-muted">
          Coming soon
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-base-text-muted">
        Receive test results, coverage reports, and CI logs from your pipelines.
      </p>
    </div>
  );
}
