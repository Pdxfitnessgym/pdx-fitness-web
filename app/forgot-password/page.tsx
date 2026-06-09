"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#1B68B4", letterSpacing: 4, lineHeight: 1 }}>PDX</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1B68B4", letterSpacing: 6 }}>FITNESS</div>
        </div>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4", marginBottom: 8 }}>Check your email</div>
            <div style={{ color: "#6B7A8D", fontSize: 15, lineHeight: 1.6 }}>
              We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
            </div>
            <Link href="/login" style={{ display: "inline-block", marginTop: 24, color: "#1B68B4", fontWeight: 600, fontSize: 14 }}>
              ← Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0D1827", marginBottom: 6 }}>Reset your password</div>
            <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 24 }}>
              Enter your email and we'll send you a reset link.
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {error && (
                <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "12px 16px", borderRadius: 10, fontSize: 14 }}>{error}</div>
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: 24, color: "#6B7A8D", fontSize: 14 }}>
              <Link href="/login" style={{ color: "#1B68B4", fontWeight: 600 }}>← Back to Sign In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #E2EAF0",
  background: "#F4F7FA",
  fontSize: 16,
  color: "#0D1827",
  outline: "none",
  width: "100%",
};

const btnStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: 12,
  background: "#2DC4B8",
  color: "#fff",
  fontWeight: 700,
  fontSize: 16,
  border: "none",
  cursor: "pointer",
  marginTop: 4,
};
