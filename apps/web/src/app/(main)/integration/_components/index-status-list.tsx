import type { IndexStatus } from "./vendor-registry";

const DOT_CLASSES: Record<IndexStatus["status"], string> = {
  ready: "bg-green-500",
  indexing: "animate-pulse bg-yellow-500",
  failed: "bg-red-500",
  pending: "bg-gray-400",
};

function formatLabel(idx: IndexStatus) {
  if (idx.status === "indexing" && idx.total_files > 0)
    return `Indexing (${idx.indexed_files}/${idx.total_files})`;
  if (idx.status === "ready") return `${idx.indexed_files} Files Indexed`;
  return idx.status;
}

export function IndexStatusList({ statuses }: { statuses?: IndexStatus[] }) {
  if (!statuses?.length) return null;

  const ready = statuses.filter((s) => s.status === "ready").length;
  const indexing = statuses.filter((s) => s.status === "indexing").length;
  const failed = statuses.filter((s) => s.status === "failed").length;

  const parts: string[] = [];
  if (ready) parts.push(`${ready} indexed`);
  if (indexing) parts.push(`${indexing} indexing`);
  if (failed) parts.push(`${failed} failed`);

  return (
    <div className="group/idx relative mt-2">
      <div className="flex cursor-default items-center gap-1.5 text-xs text-base-text-muted">
        {statuses.map((idx) => (
          <span key={idx.repo} className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[idx.status]}`} />
        ))}
        <span>{statuses.length} projects &middot; {parts.join(", ")}</span>
      </div>

      <div className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 min-w-[220px] rounded-lg border border-base-border bg-surface p-2 opacity-0 shadow-lg transition-opacity group-hover/idx:pointer-events-auto group-hover/idx:opacity-100">
        <div className="space-y-1.5">
          {statuses.map((idx) => (
            <div key={idx.repo} className="flex min-w-0 items-center gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[idx.status]}`} />
              <span className="truncate text-xs text-base-text-muted">
                <span className="font-medium text-base-text">{idx.repo.split("/").pop()}</span>
                {" — "}
                <span className="capitalize">{formatLabel(idx)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
