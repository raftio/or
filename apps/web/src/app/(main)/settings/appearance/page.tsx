"use client";

import { useTheme } from "@/components/theme-provider";

export default function AppearancePage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-base-text">
        Appearance
      </h1>
      <p className="mt-1 text-sm text-base-text-muted">
        Customize the look and feel of OR.
      </p>

      {/* Mode */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-base-text-muted">
          Mode
        </h2>
        <div className="mt-4 flex gap-4">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => { if (theme !== mode) toggleTheme(); }}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                theme === mode
                  ? "border-primary bg-primary/5"
                  : "border-base-border hover:border-base-text-muted"
              }`}
            >
              <div
                className={`flex h-16 w-28 items-end gap-1.5 rounded-lg border p-2 ${
                  mode === "dark"
                    ? "border-gray-700 bg-gray-900"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className={`h-full w-4 rounded ${mode === "dark" ? "bg-gray-700" : "bg-gray-100"}`} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className={`h-2 w-3/4 rounded ${mode === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                  <div className={`h-2 w-1/2 rounded ${mode === "dark" ? "bg-gray-600" : "bg-gray-100"}`} />
                </div>
              </div>
              <span className={`text-sm font-medium capitalize ${
                theme === mode ? "text-primary" : "text-base-text-muted"
              }`}>
                {mode}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
