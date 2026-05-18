"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"client" | "trainer">("client");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) { setError(error.message); setLoading(false); return; }

    if (data.user) {
      const isAdmin = data.user.email === "pdxfitnessgym@gmail.com";
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email!,
        full_name: fullName,
        role,
        is_approved: role !== "trainer" || isAdmin,
      });
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    if (role === "trainer") {
      return (
        <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginBottom: 8 }}>Request Submitted</div>
            <div style={{ color: "#6B7A8D", fontSize: 15, lineHeight: 1.6 }}>
              Your trainer account request has been submitted. An admin will review and approve your account before you can log in.
            </div>
            <Link href="/login" style={{ display: "inline-block", marginTop: 24, padding: "12px 28px", borderRadius: 12, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
              ← Back to Sign In
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginBottom: 8 }}>Check your email</div>
          <div style={{ color: "#6B7A8D", fontSize: 15 }}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</div>
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
          <div style={{ marginTop: 8, color: "#6B7A8D", fontSize: 14 }}>Create your account</div>
        </div>

        <form onSubmit={signUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "12px 16px", borderRadius: 10, fontSize: 14 }}>{error}</div>}
          <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} required style={inputStyle} />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />

          <div>
            <div style={{ color: "#6B7A8D", fontSize: 13, marginBottom: 8 }}>I am a...</div>
            <div style={{ display: "flex", gap: 10 }}>
              {(["client", "trainer"] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)} style={{
                  flex: 1, padding: "12px", borderRadius: 12,
                  border: `1.5px solid ${role === r ? "#2DC4B8" : "#E2EAF0"}`,
                  background: role === r ? "#EBF9F8" : "#F4F7FA",
                  color: role === r ? "#2DC4B8" : "#6B7A8D",
                  fontWeight: 600, cursor: "pointer", fontSize: 15,
                }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, color: "#6B7A8D", fontSize: 14 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#1B68B4", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "14px 16px", borderRadius: 12, border: "1px solid #E2EAF0",
  background: "#F4F7FA", fontSize: 16, color: "#0D1827", outline: "none", width: "100%",
};
const btnStyle: React.CSSProperties = {
  padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff",
  fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", marginTop: 4,
};
