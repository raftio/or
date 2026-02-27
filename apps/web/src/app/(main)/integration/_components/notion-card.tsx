interface NotionCardProps {
  connected: boolean;
  onClick: () => void;
}

export function NotionCard({ connected, onClick }: NotionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-4 rounded-xl border bg-surface p-6 text-left transition-shadow hover:shadow-md hover:shadow-glow/5 ${
        connected ? "border-green-500/40" : "border-base-border"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-500/10">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M4 4.5A2.5 2.5 0 0 1 6.5 2H14l6 6v11.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-15Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-base-text"
          />
          <path
            d="M14 2v6h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-base-text"
          />
          <path
            d="M8 13h8M8 17h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-base-text-muted"
          />
        </svg>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-base-text">Notion</h2>
          {connected && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500">
              Connected
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-base-text-muted">
          Fetch documentation and specs from Notion pages for context synthesis.
        </p>
      </div>
    </button>
  );
}
