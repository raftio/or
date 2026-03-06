"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }
      if (data.token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("or_token", data.token);
        }
      }
      if (data.user?.email) {
        if (typeof window !== "undefined") {
          localStorage.setItem("or_user", data.user.email);
        }
      }
      if (data.user?.name) {
        if (typeof window !== "undefined") {
          localStorage.setItem("or_user_name", data.user.name);
        }
      }
      window.location.href = "/";
    } catch {
      setError("Login failed. Please try again.");
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
            OR
          </Link>
          <p className="mt-1 text-sm text-base-text-muted">
            Control Plane
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-base-border bg-base px-4 py-3 text-base text-base-text outline-none transition placeholder:text-base-text-muted placeholder:opacity-70 focus:border-primary focus:ring-2 focus:ring-glow/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-base-text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 accent-primary"
              />
              <span>Remember me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 border-t border-base-border pt-6 text-center text-sm text-base-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
