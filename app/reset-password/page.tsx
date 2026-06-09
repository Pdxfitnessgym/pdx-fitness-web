"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Check if session already exists (came through /auth/callback PKCE flow)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSessionReady(true); return; }
    });
    // Also listen for PASSWORD_RECOVERY event (hash/implicit flow fallback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Your reset link has expired. Please request a new one.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#1B68B4", letterSpacing: 4, lineHeight: 1 }}>PDX</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1B68B4", letterSpacing: 6 }}>FITNESS</div>
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4", marginBottom: 8 }}>Password updated!</div>
            <div style={{ color: "#6B7A8D", fontSize: 15 }}>Redirecting you to sign in...</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0D1827", marginBottom: 6 }}>Set new password</div>
            <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 24 }}>
              Choose a strong password for your account.
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {error && (
                <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "12px 16px", borderRadius: 10, fontSize: 14 }}>{error}</div>
              )}
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={inputStyle}
              />
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
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
