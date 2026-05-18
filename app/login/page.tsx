"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }

    let { data: profile } = await supabase
      .from("profiles")
      .select("role, is_approved")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      const role = (data.user.user_metadata?.role as string) ?? "client";
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email!,
        full_name: (data.user.user_metadata?.full_name as string) ?? "",
        role,
        is_approved: role !== "trainer",
      });
      profile = { role, is_approved: role !== "trainer" };
    }

    if (profile.role === "trainer" && !profile.is_approved) {
      setPending(true);
      setLoading(false);
      return;
    }

    window.location.href = profile.role === "trainer" ? "/trainer" : "/client";
  }

  if (pending) {
    return (
      <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginBottom: 8 }}>Pending Approval</div>
          <div style={{ color: "#6B7A8D", fontSize: 15, lineHeight: 1.6 }}>
            Your trainer account is pending admin approval. You'll receive access once it's approved.
          </div>
          <button
            onClick={() => setPending(false)}
            style={{ marginTop: 24, padding: "12px 28px", borderRadius: 12, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#1B68B4", letterSpacing: 4, lineHeight: 1 }}>PDX</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1B68B4", letterSpacing: 6 }}>FITNESS</div>
          <div style={{ marginTop: 8, color: "#6B7A8D", fontSize: 14 }}>Train smarter. Live better.</div>
        </div>

        <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, color: "#6B7A8D", fontSize: 14 }}>
          Don't have an account?{" "}
          <Link href="/signup" style={{ color: "#1B68B4", fontWeight: 600 }}>Sign up</Link>
        </p>
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
