import type { VendorCardProps } from "./vendor-registry";

const GitLabLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="m23.546 13.903-.033-.09-3.3-8.612a.747.747 0 0 0-.713-.502.752.752 0 0 0-.7.518l-2.23 6.82H7.432l-2.23-6.82a.75.75 0 0 0-.7-.518.747.747 0 0 0-.713.502L.489 13.813l-.033.09a5.312 5.312 0 0 0 1.762 6.132l.01.007.025.019 4.36 3.263 2.157 1.633 1.313.993a.887.887 0 0 0 1.07 0l1.313-.993 2.157-1.633 4.385-3.282.011-.008a5.315 5.315 0 0 0 1.527-6.131Z"
      fill="#E24329"
    />
    <path
      d="m23.546 13.903-.033-.09a9.834 9.834 0 0 0-3.927 1.772l-7.586 5.74 4.844 3.662 4.385-3.282.011-.008a5.315 5.315 0 0 0 1.527-6.131l.78-.663Z"
      fill="#FC6D26"
    />
    <path
      d="m7.156 24.987 2.157 1.633 1.313.993a.887.887 0 0 0 1.07 0l1.313-.993 2.157-1.633-4.844-3.662-3.166 3.662Z"
      fill="#FCA326"
    />
    <path
      d="M4.414 15.585A9.834 9.834 0 0 0 .489 13.813l-.033.09a5.312 5.312 0 0 0 1.762 6.132l.01.007.025.019 4.36 3.263-2.2-7.739Z"
      fill="#FC6D26"
    />
  </svg>
);

export { GitLabLogo };

export function GitLabIssuesCard({ connected, onClick, vendorTitle, detail }: VendorCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-4 rounded-xl border bg-surface p-6 text-left transition-shadow hover:shadow-md hover:shadow-glow/5 ${
        connected ? "border-green-500/40" : "border-base-border"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
        <GitLabLogo />
      </div>
      <div className="min-w-0 flex-1">
        {connected ? (
          <>
            <h2 className="text-lg font-semibold text-base-text truncate">
              {detail || vendorTitle || "GitLab Issues"}
            </h2>
            <p className="text-sm text-base-text-muted">{vendorTitle || "GitLab Issues"}</p>
            <span className="mt-1.5 inline-block rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500">
              Connected
            </span>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-base-text">GitLab Issues</h2>
            <p className="mt-1 text-sm leading-relaxed text-base-text-muted">
              Import issues from a GitLab project for context and traceability.
            </p>
          </>
        )}
      </div>
    </button>
  );
}
