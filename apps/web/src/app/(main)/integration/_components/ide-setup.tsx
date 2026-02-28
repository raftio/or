"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const EXTENSION_CONFIG = `{
  "orca.apiUrl": "${API_URL}",
  "orca.apiToken": "<paste-your-token-here>"
}`;

export function IdeSetup() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(EXTENSION_CONFIG);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may not be available
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-base-text">1. Install the extension</h3>
        <p className="mt-2 text-sm leading-relaxed text-base-text-muted">
          Install the <strong>Orca</strong> extension from the VS Marketplace,
          or build and install the VSIX from the{" "}
          <code className="rounded bg-base px-1.5 py-0.5 text-xs font-mono text-base-text">
            vsc-orca
          </code>{" "}
          repo:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-base p-3 text-xs font-mono text-base-text-muted">
          cd vsc-orca{"\n"}npm install &amp;&amp; npm run package{"\n"}code
          --install-extension vsc-orca-0.1.0.vsix
        </pre>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-base-text">2. Generate an API token</h3>
        <p className="mt-2 text-sm leading-relaxed text-base-text-muted">
          Go to{" "}
          <Link
            href="/settings/api-tokens"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            Settings &rarr; API Tokens
          </Link>{" "}
          to generate a token for this workspace. Copy the token — it is only shown once.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-base-text">3. Configure settings</h3>
        <p className="mt-2 text-sm leading-relaxed text-base-text-muted">
          Open VSCode/Cursor Settings (<kbd className="rounded bg-base px-1.5 py-0.5 text-xs font-mono">Cmd+,</kbd>)
          and search for <strong>Orca</strong>, or add to your{" "}
          <code className="rounded bg-base px-1.5 py-0.5 text-xs font-mono text-base-text">
            settings.json
          </code>
          :
        </p>
        <div className="relative mt-2">
          <pre className="overflow-x-auto rounded-lg bg-base p-3 text-xs font-mono text-base-text-muted">
            {EXTENSION_CONFIG}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 rounded border border-base-border bg-surface px-2 py-1 text-[10px] font-medium text-base-text-muted transition-colors hover:text-base-text"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-base-text">4. Fetch your first bundle</h3>
        <p className="mt-2 text-sm leading-relaxed text-base-text-muted">
          Open the command palette (<kbd className="rounded bg-base px-1.5 py-0.5 text-xs font-mono">Cmd+Shift+P</kbd>)
          and run <strong>Orca: Fetch Bundle</strong>. Enter a Jira ticket ID
          to load the execution bundle into the sidebar.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-base-text">Available commands</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-base-text-muted">
          <li>
            <code className="rounded bg-base px-1.5 py-0.5 text-xs font-mono text-base-text">
              Orca: Fetch Bundle
            </code>{" "}
            — load execution bundle for a ticket
          </li>
          <li>
            <code className="rounded bg-base px-1.5 py-0.5 text-xs font-mono text-base-text">
              Orca: Submit Evidence
            </code>{" "}
            — report local test results
          </li>
          <li>
            <code className="rounded bg-base px-1.5 py-0.5 text-xs font-mono text-base-text">
              Orca: Disconnect
            </code>{" "}
            — clear the current bundle
          </li>
        </ul>
      </section>
    </div>
  );
}
