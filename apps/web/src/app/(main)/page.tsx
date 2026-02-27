import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Orqestra
      </h1>
      <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
        Control Plane — intent to execution to evidence to outcome.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/integration"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white no-underline transition-colors hover:bg-blue-700 hover:no-underline dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Explore Integrations
        </Link>
      </div>
    </div>
  );
}
