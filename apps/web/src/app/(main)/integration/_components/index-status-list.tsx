import type { IndexStatus } from "./vendor-registry";

const DOT_CLASSES: Record<IndexStatus["status"], string> = {
  ready: "bg-green-500",
  indexing: "animate-pulse bg-yellow-500",
  failed: "bg-red-500",
  pending: "bg-gray-400",
};

export function IndexStatusList({ statuses }: { statuses?: IndexStatus[] }) {
  if (!statuses?.length) return null;

  return (
    <div className="mt-2 space-y-1 overflow-hidden">
      {statuses.map((idx) => {
        const label =
          idx.status === "indexing" && idx.total_files > 0
            ? `${idx.status} (${idx.indexed_files}/${idx.total_files})`
            : idx.status === "ready"
              ? `${idx.indexed_files} files indexed`
              : idx.status;

        return (
          <div key={idx.repo} className="flex min-w-0 items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[idx.status]}`} />
            <span className="truncate text-xs text-base-text-muted">
              <span className="font-medium text-base-text">{idx.repo.split("/").pop()}</span>
              {" — "}
              <span className="capitalize">{label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
