import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-base-text">
        Orqestra
      </h1>
      <p className="mt-3 text-lg text-base-text-muted">
        Control Plane — intent to execution to evidence to outcome.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/integration"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-base no-underline transition-colors hover:bg-primary-hover hover:no-underline"
        >
          Explore Integrations
        </Link>
      </div>
    </div>
  );
}
