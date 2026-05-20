"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Session = {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "completed" | "no_show" | "rescheduled" | "cancelled" | "pending";
  notes: string | null;
  client_name: string;
  client_id: string;
};

type Client = { id: string; full_name: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_COLOR: Record<string, string> = {
  scheduled: "#1B68B4",
  completed: "#10B981",
  no_show: "#EF4444",
  rescheduled: "#F59E0B",
  cancelled: "#9CA3AF",
  pending: "#8B5CF6",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  no_show: "No Show",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  pending: "Pending",
};

export default function TrainerCalendarPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [calToken, setCalToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Session[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // schedule modal state
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [scheduleClient, setScheduleClient] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [sessRes, tokenRes, clientsRes] = await Promise.all([
        supabase
          .from("training_sessions")
          .select("id, scheduled_at, status, notes, profiles!client_id(full_name, id)")
          .eq("trainer_id", user.id)
          .order("scheduled_at"),
        fetch("/api/calendar/subscribe").then(r => r.json()),
        supabase.from("profiles").select("id, full_name").eq("trainer_id", user.id).order("full_name"),
      ]);

      const mapped: Session[] = (sessRes.data ?? []).map((s: any) => ({
        id: s.id,
        scheduled_at: s.scheduled_at,
        status: s.status,
        notes: s.notes,
        client_name: s.profiles?.full_name ?? "Client",
        client_id: s.profiles?.id ?? "",
      }));

      setSessions(mapped);
      setClients((clientsRes.data ?? []) as Client[]);
      setCalToken(tokenRes?.token ?? null);
      setLoading(false);
    }
    load();
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const todayStr = today.toISOString().split("T")[0];
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // map date → sessions
  const sessionMap: Record<string, Session[]> = {};
  for (const s of sessions) {
    const d = new Date(s.scheduled_at).toISOString().split("T")[0];
    if (!sessionMap[d]) sessionMap[d] = [];
    sessionMap[d].push(s);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function selectDay(dateStr: string) {
    const daySessions = sessionMap[dateStr];
    if (daySessions?.length) {
      setSelected(daySessions);
      setSelectedDate(dateStr);
    } else {
      openScheduleModal(dateStr);
    }
  }

  function openScheduleModal(dateStr: string) {
    setScheduleDate(dateStr);
    setScheduleClient(clients[0]?.id ?? "");
    setScheduleTime("09:00");
    setScheduleNotes("");
    setScheduleError("");
  }

  async function saveSession() {
    if (!scheduleDate || !scheduleClient) { setScheduleError("Select a client"); return; }
    setScheduleSaving(true);
    setScheduleError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setScheduleError("Session expired"); setScheduleSaving(false); return; }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    const { data, error } = await supabase.from("training_sessions").insert({
      trainer_id: user.id,
      client_id: scheduleClient,
      scheduled_at: scheduledAt,
      status: "scheduled",
      notes: scheduleNotes.trim() || null,
    }).select("id, scheduled_at, status, notes, profiles!client_id(full_name, id)").single();

    if (error) { setScheduleError(error.message); setScheduleSaving(false); return; }

    const newSession: Session = {
      id: data.id,
      scheduled_at: data.scheduled_at,
      status: data.status,
      notes: data.notes,
      client_name: (data as any).profiles?.full_name ?? "Client",
      client_id: (data as any).profiles?.id ?? scheduleClient,
    };
    setSessions(prev => [...prev, newSession].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    setScheduleDate(null);
    setScheduleSaving(false);
    // show the day panel with the new session
    setSelected([newSession]);
    setSelectedDate(scheduleDate);
  }

  async function cancelSession(sessionId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("training_sessions").update({ status: "cancelled" }).eq("id", sessionId);
    if (!error) {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: "cancelled" } : s));
      setSelected(prev => prev ? prev.map(s => s.id === sessionId ? { ...s, status: "cancelled" } : s) : null);
    }
  }

  async function deleteSession(sessionId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setSelected(prev => {
        const remaining = (prev ?? []).filter(s => s.id !== sessionId);
        return remaining.length > 0 ? remaining : null;
      });
    }
  }

  async function handleConfirmDecline(sessionId: string, action: "confirm" | "decline") {
    await fetch("/api/sessions/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, action }),
    });
    const newStatus = action === "confirm" ? "scheduled" : "cancelled";
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: newStatus } : s));
  }

  function copyWebcal() {
    if (!calToken) return;
    const url = `webcal://${window.location.host}/api/calendar/trainer/${calToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // upcoming sessions for the sidebar list
  const upcoming = sessions
    .filter(s => s.status === "scheduled" && new Date(s.scheduled_at) >= new Date())
    .slice(0, 5);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Session Calendar</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Calendar */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E2EAF0" }}>
            <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 18, cursor: "pointer" }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0D1827" }}>{MONTHS[viewMonth]} {viewYear}</div>
            <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 18, cursor: "pointer" }}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "10px 12px 4px" }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, padding: "4px 12px 16px" }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const daySessions = sessionMap[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              const hasSession = daySessions.length > 0;
              const allDone = hasSession && daySessions.every(s => s.status === "completed");
              const hasNoShow = hasSession && daySessions.some(s => s.status === "no_show");

              return (
                <button
                  key={i}
                  onClick={() => selectDay(dateStr)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 10,
                    border: "none",
                    background: hasSession ? (allDone ? "#D1FAE5" : hasNoShow ? "#FEE2E2" : "#EFF6FF") : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    padding: 2,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isToday ? "#1B68B4" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 800 : hasSession ? 700 : 400, color: isToday ? "#fff" : hasSession ? (allDone ? "#059669" : "#1B68B4") : "#0D1827" }}>
                      {day}
                    </span>
                  </div>
                  {hasSession && (
                    <div style={{ display: "flex", gap: 2 }}>
                      {daySessions.slice(0, 3).map((s, idx) => (
                        <div key={idx} style={{ width: 5, height: 5, borderRadius: "50%", background: STATUS_COLOR[s.status] }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 12, padding: "0 16px 16px", flexWrap: "wrap" }}>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[key] }} />
                <span style={{ fontSize: 11, color: "#6B7A8D" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected day sessions */}
        {selected && selectedDate && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1B68B4" }}>
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => openScheduleModal(selectedDate)} style={{ fontSize: 12, fontWeight: 700, color: "#1B68B4", background: "#EFF6FF", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>+ Schedule</button>
                <button onClick={() => setSelected(null)} style={{ color: "#9CA3AF", background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.map(s => (
                <div key={s.id} style={{ padding: "12px 14px", background: "#F8FAFB", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{s.client_name}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                        {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[s.status], background: STATUS_COLOR[s.status] + "18", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/trainer/clients/${s.client_id}`} style={{ flex: 1, textAlign: "center", padding: "7px", borderRadius: 8, background: "#EFF6FF", color: "#1B68B4", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>View</Link>
                    {(s.status === "scheduled" || s.status === "rescheduled") && (
                      <button onClick={() => cancelSession(s.id)} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "#FEF3C7", color: "#D97706", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer" }}>Cancel</button>
                    )}
                    <button onClick={() => deleteSession(s.id)} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "#FEE2E2", color: "#EF4444", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer" }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule session modal */}
        {scheduleDate && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(13,24,39,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 640, padding: "24px 20px 40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1827" }}>
                  Schedule Session
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#6B7A8D", marginTop: 2 }}>
                    {new Date(scheduleDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </div>
                </div>
                <button onClick={() => setScheduleDate(null)} style={{ color: "#9CA3AF", background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D", marginBottom: 6 }}>Client</div>
                  <select
                    value={scheduleClient}
                    onChange={e => setScheduleClient(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", fontSize: 15, background: "#F8FAFB", appearance: "none" }}
                  >
                    {clients.length === 0 && <option value="">No clients yet</option>}
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D", marginBottom: 6 }}>Time</div>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", fontSize: 15, background: "#F8FAFB" }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D", marginBottom: 6 }}>Notes (optional)</div>
                  <input
                    type="text"
                    value={scheduleNotes}
                    onChange={e => setScheduleNotes(e.target.value)}
                    placeholder="e.g. Upper body focus, bring bands"
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", fontSize: 15, background: "#F8FAFB" }}
                  />
                </div>

                {scheduleError && <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 600 }}>{scheduleError}</div>}

                <button
                  onClick={saveSession}
                  disabled={scheduleSaving || clients.length === 0}
                  style={{ width: "100%", padding: 14, borderRadius: 12, background: scheduleSaving ? "#9CA3AF" : "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginTop: 4 }}
                >
                  {scheduleSaving ? "Scheduling…" : "Confirm Session"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending session requests */}
        {sessions.filter(s => s.status === "pending").length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "2px solid #8B5CF6" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              🔔 Pending Requests ({sessions.filter(s => s.status === "pending").length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sessions.filter(s => s.status === "pending").map(s => (
                <div key={s.id} style={{ background: "#FAF5FF", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{s.client_name}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                        {new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}
                        {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                      {s.notes && <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2, fontStyle: "italic" }}>{s.notes}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleConfirmDecline(s.id, "confirm")}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#10B981", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
                    >
                      ✓ Confirm
                    </button>
                    <button
                      onClick={() => handleConfirmDecline(s.id, "decline")}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#FEE2E2", color: "#EF4444", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming sessions */}
        {upcoming.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Upcoming</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcoming.map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{s.client_name}</div>
                    <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 1 }}>
                      {new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {" · "}
                      {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <Link href={`/trainer/clients/${s.client_id}`} style={{ fontSize: 12, color: "#2DC4B8", textDecoration: "none", fontWeight: 600 }}>View →</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>Sync to your calendar</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 14 }}>All your client sessions in Apple Calendar or Google Calendar, auto-updated.</div>
          <button
            onClick={copyWebcal}
            disabled={!calToken}
            style={{ width: "100%", padding: "13px", borderRadius: 12, background: copied ? "#10B981" : "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", marginBottom: 12 }}
          >
            {copied ? "✓ Link copied!" : "Copy Calendar Link"}
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { title: "Apple Calendar", steps: "File → New Calendar Subscription → Paste link" },
              { title: "Google Calendar", steps: "Other calendars → From URL → Paste link" },
            ].map(c => (
              <div key={c.title} style={{ background: "#F4F7FA", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: "#6B7A8D" }}>{c.steps}</div>
              </div>
            ))}
          </div>
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>}
      </div>
    </div>
  );
}
