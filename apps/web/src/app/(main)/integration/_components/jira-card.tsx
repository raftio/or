import type { VendorCardProps } from "./vendor-registry";

export function JiraCard({ connected, onClick, vendorTitle, detail }: VendorCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-4 rounded-xl border bg-surface p-6 text-left transition-shadow hover:shadow-md hover:shadow-glow/5 ${
        connected ? "border-green-500/40" : "border-base-border"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M11.53 2c-.55 0-1.06.22-1.43.59L2.59 10.1a2.01 2.01 0 0 0 0 2.83l8.49 8.49c.78.78 2.05.78 2.83 0l7.51-7.51c.78-.78.78-2.05 0-2.83L13 2.59A2.01 2.01 0 0 0 11.53 2Z"
            stroke="#2684FF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="1.5" fill="#2684FF" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        {connected ? (
          <>
            <h2 className="text-lg font-semibold text-base-text truncate">
              {detail || vendorTitle || "Jira Cloud"}
            </h2>
            <p className="text-sm text-base-text-muted">{vendorTitle || "Jira Cloud"}</p>
            <span className="mt-1.5 inline-block rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500">
              Connected
            </span>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-base-text">Jira Cloud</h2>
            <p className="mt-1 text-sm leading-relaxed text-base-text-muted">
              Sync tickets and documentation sources for full traceability.
            </p>
          </>
        )}
      </div>
    </button>
  );
}
