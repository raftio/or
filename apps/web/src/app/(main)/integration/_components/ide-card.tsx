import type { VendorCardProps } from "./vendor-registry";

export function IdeCard({ onClick }: VendorCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl border border-base-border bg-surface p-6 text-left transition-shadow hover:shadow-md hover:shadow-glow/5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a855f7"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-base-text">IDE / Agent</h2>
        <p className="mt-1 text-sm leading-relaxed text-base-text-muted">
          Interface with VSCode, Cursor, and JetBrains — receive execution
          bundles and submit evidence.
        </p>
      </div>
    </button>
  );
}
