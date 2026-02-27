export default function IntegrationPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-base-text">
        Integration
      </h1>
      <p className="mt-3 text-base-text-muted">
        Connect Orqestra with your existing tools — CI/CD pipelines, IDEs, Git
        providers, and more.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <IntegrationCard
          title="CI/CD"
          description="Receive test results, coverage reports, and CI logs from your pipelines."
        />
        <IntegrationCard
          title="IDE / Agent"
          description="Interface with VSCode, Cursor, and JetBrains — receive execution bundles and submit evidence."
        />
        <IntegrationCard
          title="Git Provider"
          description="Link PRs, commits, and branches to execution bundles and evidence."
        />
        <IntegrationCard
          title="Ticket / Docs"
          description="Sync tickets and documentation sources for full traceability."
        />
      </div>
    </div>
  );
}

function IntegrationCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-base-border bg-surface p-6 transition-shadow hover:shadow-md hover:shadow-glow/5">
      <h2 className="text-lg font-semibold text-base-text">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-base-text-muted">
        {description}
      </p>
    </div>
  );
}
