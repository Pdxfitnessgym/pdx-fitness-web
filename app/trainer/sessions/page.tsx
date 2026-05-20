"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Session = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  client: { id: string; full_name: string | null };
};

type Tab = "pending" | "upcoming" | "past";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export default function TrainerSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("training_sessions")
      .select("id, scheduled_at, status, notes, profiles!client_id(id, full_name)")
      .eq("trainer_id", user.id)
      .order("scheduled_at", { ascending: true });
    setSessions((data ?? []).map((s: any) => ({
      ...s,
      client: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
    })));
    setLoading(false);
  }

  async function doAction(sessionId: string, action: "confirm" | "decline") {
    setActing(sessionId);
    await fetch("/api/sessions/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, action }),
    });
    await load();
    setActing(null);
  }

  async function updateStatus(sessionId: string, status: "completed" | "no_show" | "cancelled") {
    setActing(sessionId);
    const supabase = createClient();
    await supabase.from("training_sessions").update({ status }).eq("id", sessionId);
    await load();
    setActing(null);
  }

  const now = new Date().toISOString();
  const pending = sessions.filter(s => s.status === "pending");
  const upcoming = sessions.filter(s => s.status === "scheduled" && s.scheduled_at >= now);
  const past = sessions.filter(s => ["completed", "no_show", "cancelled"].includes(s.status) || (s.status === "scheduled" && s.scheduled_at < now));

  const tabSessions = tab === "pending" ? pending : tab === "upcoming" ? upcoming : past;

  const statusBadge: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: "Pending",   bg: "#FEF3C7", color: "#D97706" },
    scheduled: { label: "Confirmed", bg: "#DBEAFE", color: "#1B68B4" },
    completed: { label: "Completed", bg: "#D1FAE5", color: "#059669" },
    no_show:   { label: "No Show",   bg: "#FEE2E2", color: "#DC2626" },
    cancelled: { label: "Cancelled", bg: "#F3F4F6", color: "#6B7A8D" },
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Sessions</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex" }}>
          {(["pending", "upcoming", "past"] as Tab[]).map(t => {
            const count = t === "pending" ? pending.length : t === "upcoming" ? upcoming.length : past.length;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "14px 0", background: "none", border: "none", cursor: "pointer",
                fontWeight: tab === t ? 700 : 500, fontSize: 14,
                color: tab === t ? "#1B68B4" : "#6B7A8D",
                borderBottom: tab === t ? "2.5px solid #1B68B4" : "2.5px solid transparent",
                textTransform: "capitalize",
              }}>
                {t} {count > 0 && <span style={{ fontSize: 12, background: t === "pending" ? "#FEF3C7" : "#F4F7FA", color: t === "pending" ? "#D97706" : "#6B7A8D", borderRadius: 10, padding: "2px 7px", marginLeft: 4 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
        ) : !tabSessions.length ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              {tab === "pending" ? "✅" : tab === "upcoming" ? "📅" : "📋"}
            </div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>
              {tab === "pending" ? "No pending requests" : tab === "upcoming" ? "No upcoming sessions" : "No session history"}
            </div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>
              {tab === "pending" ? "New booking requests will appear here" : tab === "upcoming" ? "Confirmed sessions will appear here" : "Completed sessions will appear here"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tabSessions.map(s => {
              const { date, time } = fmtDateTime(s.scheduled_at);
              const badge = statusBadge[s.status] ?? statusBadge.cancelled;
              const isActing = acting === s.id;
              return (
                <div key={s.id} style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#0D1827" }}>{s.client?.full_name ?? "Client"}</div>
                      <div style={{ fontSize: 14, color: "#6B7A8D", marginTop: 2 }}>{date} · {time}</div>
                      {s.notes && <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4, fontStyle: "italic" }}>"{s.notes}"</div>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.label}</div>
                  </div>

                  {tab === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => doAction(s.id, "confirm")} disabled={isActing} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: isActing ? 0.6 : 1 }}>
                        {isActing ? "..." : "✓ Confirm"}
                      </button>
                      <button onClick={() => doAction(s.id, "decline")} disabled={isActing} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: isActing ? 0.6 : 1 }}>
                        {isActing ? "..." : "✕ Decline"}
                      </button>
                    </div>
                  )}

                  {tab === "upcoming" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => updateStatus(s.id, "completed")} disabled={isActing} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#D1FAE5", color: "#059669", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: isActing ? 0.6 : 1 }}>
                        {isActing ? "..." : "✓ Complete"}
                      </button>
                      <button onClick={() => updateStatus(s.id, "no_show")} disabled={isActing} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer", opacity: isActing ? 0.6 : 1 }}>
                        No Show
                      </button>
                      <button onClick={() => updateStatus(s.id, "cancelled")} disabled={isActing} style={{ padding: "11px 14px", borderRadius: 10, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 14, border: "1px solid #E2EAF0", cursor: "pointer", opacity: isActing ? 0.6 : 1 }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
