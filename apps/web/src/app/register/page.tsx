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
        typeof window !== "undefined" &&
          localStorage.setItem("orqestra_token", data.token);
      }
      if (data.user?.email) {
        typeof window !== "undefined" &&
          localStorage.setItem("orqestra_user", data.user.email);
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-blob auth-blob-1" aria-hidden />
      <div className="auth-blob auth-blob-2" aria-hidden />
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">
            Orqestra
          </Link>
          <p className="auth-tagline">Create an account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
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
          <div className="auth-field">
            <label htmlFor="password">Password (at least 8 characters)</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-wrap {
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
        .auth-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
          pointer-events: none;
        }
        .auth-blob-1 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, var(--accent-glow-soft) 0%, transparent 70%);
          top: -120px;
          right: -80px;
        }
        .auth-blob-2 {
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
          bottom: -80px;
          left: -60px;
        }
        .auth-card {
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
        .auth-card:hover {
          border-color: rgba(37, 99, 235, 0.5);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(0, 0, 0, 0.06),
            0 0 48px rgba(37, 99, 235, 0.2);
        }
        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .auth-logo {
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text);
          text-decoration: none;
        }
        .auth-logo:hover {
          color: var(--accent);
          text-decoration: none;
        }
        .auth-tagline {
          margin: 0.25rem 0 0;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .auth-field label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-muted);
        }
        .auth-field input {
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
        .auth-field input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2),
            0 0 16px var(--accent-glow-soft);
        }
        .auth-field input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .auth-error {
          margin: 0;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: var(--error);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
        }
        .auth-submit {
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
        .auth-submit:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: 0 0 24px var(--accent-glow);
        }
        .auth-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-footer {
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
