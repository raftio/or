import type { VendorCardProps } from "./vendor-registry";

export function ConfluenceCard({ connected, onClick, vendorTitle, detail }: VendorCardProps) {
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
            d="M3.89 17.05c-.2.32-.44.72-.44.96 0 .24.16.48.4.6l4.4 2.56c.24.12.56.12.72-.12.16-.24.36-.56.56-.88 1.24-2.08 2.48-2.32 5.2-.96l4.24 2.16c.28.12.6.08.8-.16.16-.2.24-.48.24-.72l.04-5.04c0-.4-.24-.76-.6-.92L14.2 11.7c-.24-.12-.56-.08-.76.08-2.84 2.64-6.6 3.96-9.56 5.28Z"
            stroke="#2684FF"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20.12 6.95c.2-.32.44-.72.44-.96 0-.24-.16-.48-.4-.6L15.76 2.83c-.24-.12-.56-.12-.72.12-.16.24-.36.56-.56.88-1.24 2.08-2.48 2.32-5.2.96L5.04 2.63c-.28-.12-.6-.08-.8.16-.16.2-.24.48-.24.72l-.04 5.04c0 .4.24.76.6.92l5.24 2.84c.24.12.56.08.76-.08 2.84-2.64 6.6-3.96 9.56-5.28Z"
            stroke="#2684FF"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        {connected ? (
          <>
            <h2 className="text-lg font-semibold text-base-text truncate">
              {detail || vendorTitle || "Confluence"}
            </h2>
            <p className="text-sm text-base-text-muted">{vendorTitle || "Confluence"}</p>
            <span className="mt-1.5 inline-block rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500">
              Connected
            </span>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-base-text">Confluence</h2>
            <p className="mt-1 text-sm leading-relaxed text-base-text-muted">
              Fetch specifications and docs from Confluence pages for context synthesis.
            </p>
          </>
        )}
      </div>
    </button>
  );
}
