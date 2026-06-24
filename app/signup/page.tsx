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
  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (role === "trainer") {
      window.location.href = "/pending-approval";
      return;
    }

    // Sign in immediately (works when email confirmation is disabled)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      // Fallback: account created but confirmation still required
      setError("Account created! Please check your email to confirm before signing in.");
      setLoading(false);
      return;
    }
    window.location.href = "/client";
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
