"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

type Session = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  trainer: { full_name: string | null };
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export default function ClientSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("training_sessions")
      .select("id, scheduled_at, status, notes, profiles!trainer_id(full_name)")
      .eq("client_id", user.id)
      .order("scheduled_at", { ascending: false });
    setSessions((data ?? []).map((s: any) => ({
      ...s,
      trainer: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
    })));
    setLoading(false);
  }

  async function cancelSession(id: string) {
    setCancelling(id);
    const supabase = createClient();
    await supabase.from("training_sessions").update({ status: "cancelled" }).eq("id", id);
    await load();
    setCancelling(null);
  }

  const now = new Date().toISOString();
  const upcoming = sessions.filter(s => (s.status === "scheduled" || s.status === "pending") && s.scheduled_at >= now);
  const past = sessions.filter(s => ["completed", "no_show", "cancelled"].includes(s.status) || (s.status === "scheduled" && s.scheduled_at < now));

  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg: "#FEF3C7", color: "#D97706", label: "Awaiting Confirmation" },
    scheduled: { bg: "#DBEAFE", color: "#1B68B4", label: "Confirmed" },
    completed: { bg: "#D1FAE5", color: "#059669", label: "Completed" },
    no_show:   { bg: "#FEE2E2", color: "#DC2626", label: "No Show" },
    cancelled: { bg: "#F3F4F6", color: "#6B7A8D", label: "Cancelled" },
  };

  function SessionCard({ s }: { s: Session }) {
    const { date, time } = fmtDateTime(s.scheduled_at);
    const style = statusStyle[s.status] ?? statusStyle.cancelled;
    const canCancel = (s.status === "pending" || s.status === "scheduled") && s.scheduled_at >= now;
    return (
      <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: canCancel ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>{date}</div>
            <div style={{ fontSize: 14, color: "#6B7A8D", marginTop: 2 }}>{time} · with {s.trainer?.full_name ?? "Trainer"}</div>
            {s.notes && <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4, fontStyle: "italic" }}>"{s.notes}"</div>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: style.bg, color: style.color, flexShrink: 0, whiteSpace: "nowrap" }}>{style.label}</div>
        </div>
        {canCancel && (
          <button
            onClick={() => cancelSession(s.id)}
            disabled={cancelling === s.id}
            style={{ padding: "10px 16px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", opacity: cancelling === s.id ? 0.6 : 1 }}
          >
            {cancelling === s.id ? "Cancelling..." : "Cancel Session"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>My Sessions</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
        ) : (
          <>
            {/* Book button */}
            <Link href="/client/book" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", textAlign: "center" }}>
              + Book a Session
            </Link>

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Upcoming</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {upcoming.map(s => <SessionCard key={s.id} s={s} />)}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Past Sessions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {past.map(s => <SessionCard key={s.id} s={s} />)}
                </div>
              </div>
            )}

            {upcoming.length === 0 && past.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 24px", background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No sessions yet</div>
                <div style={{ fontSize: 14, color: "#6B7A8D" }}>Book a session with your trainer above</div>
              </div>
            )}
          </>
        )}
      </div>

      <ClientBottomNav />
    </div>
  );
}
