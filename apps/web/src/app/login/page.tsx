"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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
        typeof window !== "undefined" &&
          localStorage.setItem("orqestra_token", data.token);
      }
      if (remember && data.user?.email) {
        typeof window !== "undefined" &&
          localStorage.setItem("orqestra_user", data.user.email);
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-blob login-blob-1" aria-hidden />
      <div className="login-blob login-blob-2" aria-hidden />
      <div className="login-card">
        <div className="login-header">
          <Link href="/" className="login-logo">
            Orqestra
          </Link>
          <p className="login-tagline">Control Plane</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="login-options">
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
              <span>Remember me</span>
            </label>
            <Link href="/forgot-password" className="login-forgot">
              Forgot password?
            </Link>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="login-footer">
          Don&apos;t have an account?{" "}
          <Link href="/register">Sign up</Link>
        </p>
      </div>

      <style jsx>{`
        .login-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          background: radial-gradient(
              ellipse 80% 50% at 50% -20%,
              var(--accent-glow-soft),
              transparent 50%
            ),
            var(--bg);
        }
        .login-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
          pointer-events: none;
        }
        .login-blob-1 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, var(--accent-glow-soft) 0%, transparent 70%);
          top: -120px;
          right: -80px;
        }
        .login-blob-2 {
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
          bottom: -80px;
          left: -60px;
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          position: relative;
          z-index: 1;
          background: var(--surface-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-glow);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06),
            0 0 0 1px rgba(0, 0, 0, 0.04),
            0 0 40px var(--accent-glow-soft);
          transition: box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .login-card:hover {
          border-color: rgba(37, 99, 235, 0.5);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(0, 0, 0, 0.06),
            0 0 48px rgba(37, 99, 235, 0.2);
        }
        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .login-logo {
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text);
          text-decoration: none;
        }
        .login-logo:hover {
          color: var(--accent);
          text-decoration: none;
        }
        .login-tagline {
          margin: 0.25rem 0 0;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .login-field label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-muted);
        }
        .login-field input {
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 1rem;
          font-family: inherit;
          color: var(--text);
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-field input::placeholder {
          color: var(--text-muted);
          opacity: 0.7;
        }
        .login-field input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2),
            0 0 16px var(--accent-glow-soft);
        }
        .login-field input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .login-remember {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-muted);
          cursor: pointer;
        }
        .login-remember input {
          width: 1rem;
          height: 1rem;
          accent-color: var(--accent);
        }
        .login-forgot {
          font-size: 0.875rem;
        }
        .login-error {
          margin: 0;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: var(--error);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
        }
        .login-submit {
          margin-top: 0.25rem;
          padding: 0.875rem 1.25rem;
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          color: var(--button-text);
          background: var(--accent);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s, box-shadow 0.25s ease;
          box-shadow: 0 0 0 rgba(37, 99, 235, 0);
        }
        .login-submit:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: 0 0 24px var(--accent-glow);
        }
        .login-submit:active:not(:disabled) {
          transform: scale(0.99);
        }
        .login-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .login-footer {
          margin: 1.5rem 0 0;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
          font-size: 0.875rem;
          color: var(--text-muted);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
