"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  sessions: number; sets?: number; volume?: number; prs?: number;
  topPrs?: string[]; avgRpe?: number | null; workouts?: string[];
};

// The trainer generates a draft, edits it, then sends it. Nothing goes to the
// client without them pressing send.
export function MonthlyRecap({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function generate() {
    setLoading(true); setError(""); setSent(false);
    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't build the recap."); setLoading(false); return; }
      setStats(data.stats);
      setDraft(data.draft ?? "");
      if (data.error) setError(data.error);
    } catch {
      setError("Couldn't reach the server.");
    }
    setLoading(false);
  }

  async function send() {
    if (!draft.trim()) return;
    setSending(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired."); setSending(false); return; }

    // Reuse the existing one-to-one conversation, or start one
    const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
    const myIds = (mine ?? []).map(m => m.conversation_id);
    let convoId: string | null = null;

    if (myIds.length) {
      const [{ data: solo }, { data: theirs }] = await Promise.all([
        supabase.from("conversations").select("id").in("id", myIds).eq("is_group", false),
        supabase.from("conversation_members").select("conversation_id").eq("user_id", clientId).in("conversation_id", myIds),
      ]);
      const soloIds = new Set((solo ?? []).map(c => c.id));
      convoId = (theirs ?? []).find(t => soloIds.has(t.conversation_id))?.conversation_id ?? null;
    }

    if (!convoId) {
      const { data: convo, error: cErr } = await supabase
        .from("conversations").insert({ is_group: false, name: null, created_by: user.id }).select("id").single();
      if (cErr || !convo) { setError(cErr?.message ?? "Couldn't start a chat."); setSending(false); return; }
      convoId = convo.id;
      const { error: mErr } = await supabase.from("conversation_members").insert([
        { conversation_id: convoId, user_id: user.id },
        { conversation_id: convoId, user_id: clientId },
      ]);
      if (mErr) { setError(mErr.message); setSending(false); return; }
    }

    const { error: sErr } = await supabase.from("messages")
      .insert({ conversation_id: convoId, sender_id: user.id, content: draft.trim() });
    if (sErr) { setError(sErr.message); setSending(false); return; }

    setSent(true);
    setSending(false);
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); generate(); }} style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", border: "1.5px dashed #2DC4B8", background: "#F0FDFC" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0F766E" }}>📋 Draft a monthly recap</div>
        <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
          Last 30 days of {clientName.split(" ")[0]}&apos;s training, written up for you to edit and send.
        </div>
      </button>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>Monthly recap</div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#6B7A8D", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
      </div>

      {loading && <div style={{ fontSize: 14, color: "#6B7A8D", padding: "12px 0" }}>Pulling the numbers…</div>}

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Sessions", value: String(stats.sessions) },
            { label: "Sets", value: String(stats.sets ?? 0) },
            { label: "Lbs moved", value: (stats.volume ?? 0).toLocaleString() },
            { label: "PRs", value: String(stats.prs ?? 0) },
          ].map(s => (
            <div key={s.label} style={{ background: "#F8FAFB", borderRadius: 10, padding: "10px 8px", textAlign: "center", border: "1px solid #E2EAF0" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1B68B4" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#6B7A8D", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!loading && (
        <>
          <textarea
            value={draft}
            onChange={e => { setDraft(e.target.value); setSent(false); }}
            rows={9}
            placeholder="Your recap will appear here — edit it freely before sending."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F8FAFB", fontSize: 14, color: "#0D1827", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 11, color: "#9CA3AF", margin: "6px 0 12px" }}>
            A draft, not a message. Nothing is sent until you press send.
          </div>

          {sent ? (
            <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
              ✓ Sent to {clientName.split(" ")[0]}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={generate} disabled={loading} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#fff", border: "1px solid #E2EAF0", color: "#6B7A8D", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Redraft
              </button>
              <button onClick={send} disabled={sending || !draft.trim()} style={{ flex: 2, padding: "12px", borderRadius: 10, background: "#2DC4B8", border: "none", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: sending || !draft.trim() ? 0.5 : 1 }}>
                {sending ? "Sending…" : "Send as a message"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0", marginBottom: 12,
};
