"use client";

import { useTheme, type Accent } from "@/components/theme-provider";

const accents: { id: Accent; label: string; colors: { light: string; dark: string } }[] = [
  {
    id: "cyan",
    label: "Cyan",
    colors: { light: "#06B6D4", dark: "#00F5FF" },
  },
  {
    id: "pink",
    label: "Pink",
    colors: { light: "#EC4899", dark: "#F472B6" },
  },
];

export default function AppearancePage() {
  const { theme, toggleTheme, accent, setAccent } = useTheme();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-base-text">
        Appearance
      </h1>
      <p className="mt-1 text-sm text-base-text-muted">
        Customize the look and feel of Orca.
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

      {/* Color Theme */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-base-text-muted">
          Color Theme
        </h2>
        <div className="mt-4 flex gap-4">
          {accents.map((a) => {
            const selected = accent === a.id;
            const displayColor = theme === "dark" ? a.colors.dark : a.colors.light;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccent(a.id)}
                className={`group flex flex-col items-center gap-2 rounded-xl border-2 px-6 py-4 transition-colors ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-base-border hover:border-base-text-muted"
                }`}
              >
                <div
                  className="h-10 w-10 rounded-full ring-2 ring-offset-2 ring-offset-base transition-shadow"
                  style={{
                    backgroundColor: displayColor,
                    ringColor: selected ? displayColor : "transparent",
                    boxShadow: selected ? `0 0 12px ${displayColor}40` : "none",
                  }}
                />
                <span className={`text-sm font-medium ${
                  selected ? "text-primary" : "text-base-text-muted"
                }`}>
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
