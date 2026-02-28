import Link from "next/link";

export default function Home() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-base-text">
        Orca
      </h1>
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
