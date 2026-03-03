import Link from "next/link";
import { OrLoader } from "@/components/or-loader";

export default function Home() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-3">
        <OrLoader size={48} filled />
      </div>
      <p className="mt-2 max-w-md text-sm text-base-text-muted">
        Control Plane — intent to execution to evidence to outcome.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/integration"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-base no-underline transition-colors hover:bg-primary-hover hover:no-underline"
        >
          Explore Integrations
        </Link>
        <Link
          href="/chat"
          className="rounded-xl border border-base-border bg-surface px-5 py-2.5 text-sm font-medium text-base-text no-underline transition-colors hover:bg-primary/5 hover:no-underline"
        >
          Open Chat
        </Link>
      </div>
    </div>
  );
}
