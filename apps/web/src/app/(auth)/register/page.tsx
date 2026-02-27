"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.details?.fieldErrors?.password?.[0] ||
          data.error ||
          "Registration failed.";
        setError(msg);
        return;
      }
      if (data.token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("orqestra_token", data.token);
        }
      }
      if (data.user?.email) {
        if (typeof window !== "undefined") {
          localStorage.setItem("orqestra_user", data.user.email);
        }
      }
      if (data.user?.name) {
        if (typeof window !== "undefined") {
          localStorage.setItem("orqestra_user_name", data.user.name);
        }
      }
      window.location.href = "/";
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-base p-6">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_srgb,var(--color-glow)_15%,transparent),transparent_50%)]"
        aria-hidden
      />
      <div
        className="absolute -right-20 -top-32 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-glow)_15%,transparent)_0%,transparent_70%)] opacity-40 blur-[80px] pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-20 -left-16 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-secondary)_15%,transparent)_0%,transparent_70%)] opacity-40 blur-[80px] pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-[400px] rounded-2xl border border-primary/35 bg-surface/90 p-8 shadow-lg shadow-black/5 ring-1 ring-base-border backdrop-blur-xl transition-all duration-200 hover:border-glow/50 hover:shadow-xl hover:shadow-glow/20">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-3xl font-bold tracking-tight text-base-text no-underline hover:text-primary"
          >
            Orqestra
          </Link>
          <p className="mt-1 text-sm text-base-text-muted">
            Create an account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-base-text-muted"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-base-border bg-base px-4 py-3 text-base text-base-text outline-none transition placeholder:text-base-text-muted placeholder:opacity-70 focus:border-primary focus:ring-2 focus:ring-glow/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-base-text-muted"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-base-border bg-base px-4 py-3 text-base text-base-text outline-none transition placeholder:text-base-text-muted placeholder:opacity-70 focus:border-primary focus:ring-2 focus:ring-glow/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-base-text-muted"
            >
              Password (at least 8 characters)
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-base-border bg-base px-4 py-3 text-base text-base-text outline-none transition placeholder:text-base-text-muted placeholder:opacity-70 focus:border-primary focus:ring-2 focus:ring-glow/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-base-text-muted"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-base-border bg-base px-4 py-3 text-base text-base-text outline-none transition placeholder:text-base-text-muted placeholder:opacity-70 focus:border-primary focus:ring-2 focus:ring-glow/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-lg bg-primary px-5 py-3.5 text-base font-semibold text-base shadow transition hover:bg-primary-hover hover:shadow-lg hover:shadow-glow/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 border-t border-base-border pt-6 text-center text-sm text-base-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
