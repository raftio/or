export function GitProviderCard() {
  return (
    <div className="rounded-xl border border-base-border bg-surface p-6 opacity-75 transition-shadow hover:shadow-md hover:shadow-glow/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" />
              <line x1="6" y1="9" x2="6" y2="21" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-base-text">
            Git Provider
          </h2>
        </div>
        <span className="rounded-full bg-base px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-base-text-muted">
          Coming soon
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-base-text-muted">
        Link PRs, commits, and branches to execution bundles and evidence.
      </p>
    </div>
  );
}
