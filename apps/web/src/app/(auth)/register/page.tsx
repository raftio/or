"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
      window.location.href = "/";
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-100 p-6 dark:bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.18),transparent_50%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(96,165,250,0.12),transparent_50%)]"
        aria-hidden
      />
      <div
        className="absolute -right-20 -top-32 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.18)_0%,transparent_70%)] opacity-40 blur-[80px] pointer-events-none dark:bg-[radial-gradient(circle,rgba(96,165,250,0.12)_0%,transparent_70%)]"
        aria-hidden
      />
      <div
        className="absolute -bottom-20 -left-16 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.15)_0%,transparent_70%)] opacity-40 blur-[80px] pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-[400px] rounded-2xl border border-blue-500/35 bg-white/90 p-8 shadow-lg shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl transition-all duration-200 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/20 dark:bg-zinc-900/90 dark:ring-white/5 dark:hover:border-blue-400/50">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-3xl font-bold tracking-tight text-zinc-900 no-underline hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
          >
            Orqestra
          </Link>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create an account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
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
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-500 placeholder:opacity-70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
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
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-500 placeholder:opacity-70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
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
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-500 placeholder:opacity-70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
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
            className="mt-1 w-full rounded-lg bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow transition hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-500 dark:hover:bg-blue-600 dark:hover:shadow-blue-400/30"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 border-t border-zinc-200 pt-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
