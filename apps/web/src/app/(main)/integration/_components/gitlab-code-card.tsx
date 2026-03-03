import type { VendorCardProps } from "./vendor-registry";
import { GitLabLogo } from "./gitlab-issues-card";

export function GitLabCodeCard({ connected, onClick, detail }: VendorCardProps) {
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
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-base-text">
            GitLab Code{detail && <span className="ml-1 font-normal text-base-text-muted">· {detail}</span>}
          </h2>
          {connected && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500">
              Connected
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-base-text-muted">
          Connect a GitLab repository for code context and branch tracking.
        </p>
      </div>
    </button>
  );
}
