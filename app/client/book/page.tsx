"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Slot = {
  id: string;
  available_date: string;
  start_time: string;
};

function formatTime(t: string): string {
  const [hourStr, minStr] = t.split(":");
  let hour = parseInt(hourStr, 10);
  const min = minStr || "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${min} ${ampm}`;
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function addOneHour(t: string): string {
  const [hourStr, minStr] = t.split(":");
  const hour = parseInt(hourStr, 10) + 1;
  return `${hour.toString().padStart(2, "0")}:${minStr || "00"}:00`;
}

const today = new Date().toISOString().split("T")[0];

export default function BookPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [trainerName, setTrainerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Slot | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("trainer_id, sessions_purchased")
        .eq("id", user.id)
        .single();

      if (!profile?.trainer_id) { setLoading(false); return; }

      setTrainerId(profile.trainer_id);

      const { data: trainerData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", profile.trainer_id)
        .single();

      setTrainerName(trainerData?.full_name || "Your Trainer");

      const { data: availableSlots } = await supabase
        .from("trainer_availability")
        .select("id, available_date, start_time")
        .eq("trainer_id", profile.trainer_id)
        .eq("is_booked", false)
        .gte("available_date", today)
        .order("available_date", { ascending: true })
        .order("start_time", { ascending: true });

      setSlots(availableSlots || []);

      const { count: completedCount } = await supabase
        .from("training_sessions")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user.id)
        .eq("status", "completed");

      if (profile.sessions_purchased > 0) {
        setSessionsRemaining(Math.max(0, profile.sessions_purchased - (completedCount || 0)));
      } else {
        setSessionsRemaining(null);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function confirmBooking() {
    if (!booking || !trainerId) return;
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: session, error: insertErr } = await supabase
      .from("training_sessions")
      .insert({
        trainer_id: trainerId,
        client_id: user.id,
        scheduled_at: new Date(`${booking.available_date}T${booking.start_time}`).toISOString(),
        status: "pending",
        notes: bookingNote.trim() || null,
        availability_id: booking.id,
      })
      .select()
      .single();

    if (insertErr || !session) {
      setError("Failed to create session. Please try again.");
      setSaving(false);
      return;
    }

    await supabase
      .from("trainer_availability")
      .update({ is_booked: true })
      .eq("id", booking.id);

    await fetch("/api/sessions/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    });

    setSlots((prev) => prev.filter((s) => s.id !== booking.id));
    setBooking(null);
    setBookingNote("");
    setSaving(false);
    setSuccess(true);
  }

  const byDate: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!byDate[s.available_date]) byDate[s.available_date] = [];
    byDate[s.available_date].push(s);
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      backgroundColor: "#F4F7FA",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "24px 16px",
    },
    maxWidth: {
      maxWidth: 600,
      margin: "0 auto",
    },
    backLink: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: "#1B68B4",
      textDecoration: "none",
      fontSize: 14,
      marginBottom: 16,
      fontWeight: 500,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: 700,
      color: "#111827",
      margin: 0,
    },
    headerSub: {
      fontSize: 14,
      color: "#6B7280",
      margin: "4px 0 24px",
    },
    sessionCard: {
      backgroundColor: "#fff",
      borderRadius: 14,
      padding: "16px 20px",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sessionCardLabel: {
      fontSize: 13,
      color: "#6B7280",
      marginBottom: 2,
    },
    sessionCardCount: {
      fontSize: 28,
      fontWeight: 700,
      color: "#111827",
    },
    sessionCardSub: {
      fontSize: 12,
      color: "#9CA3AF",
    },
    payBanner: {
      backgroundColor: "#EFF6FF",
      border: "1px solid #BFDBFE",
      borderRadius: 10,
      padding: "12px 16px",
      fontSize: 13,
      color: "#1E40AF",
      marginBottom: 16,
    },
    dateCard: {
      backgroundColor: "#fff",
      border: "1px solid #E2EAF0",
      borderRadius: 14,
      padding: 20,
      marginBottom: 16,
    },
    dateLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: "#6B7280",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      marginBottom: 12,
    },
    slotRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 12px",
      borderRadius: 8,
      marginBottom: 6,
      backgroundColor: "#F9FAFB",
      cursor: "pointer",
      border: "1px solid #E2EAF0",
    },
    slotTime: {
      fontSize: 14,
      fontWeight: 500,
      color: "#111827",
    },
    bookBtn: {
      fontSize: 13,
      fontWeight: 600,
      color: "#2DC4B8",
    },
    emptyState: {
      textAlign: "center" as const,
      padding: "60px 20px",
    },
    emptyEmoji: {
      fontSize: 40,
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: "#374151",
      margin: "0 0 6px",
    },
    emptySub: {
      fontSize: 14,
      color: "#9CA3AF",
    },
    overlay: {
      position: "fixed" as const,
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.45)",
      zIndex: 50,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    },
    sheet: {
      backgroundColor: "#fff",
      borderRadius: "18px 18px 0 0",
      padding: "28px 24px 40px",
      width: "100%",
      maxWidth: 600,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: 700,
      color: "#111827",
      marginBottom: 4,
    },
    sheetSub: {
      fontSize: 14,
      color: "#6B7280",
      marginBottom: 20,
    },
    noteLabel: {
      fontSize: 13,
      fontWeight: 500,
      color: "#374151",
      marginBottom: 6,
      display: "block",
    },
    noteInput: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #E2EAF0",
      borderRadius: 8,
      fontSize: 14,
      color: "#111827",
      resize: "vertical" as const,
      marginBottom: 20,
      boxSizing: "border-box" as const,
    },
    confirmBtn: {
      width: "100%",
      backgroundColor: "#1B68B4",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "14px",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
    },
    cancelSheetBtn: {
      width: "100%",
      background: "none",
      border: "none",
      color: "#6B7280",
      fontSize: 14,
      cursor: "pointer",
      marginTop: 12,
      padding: "8px",
    },
    successCard: {
      minHeight: "100vh",
      backgroundColor: "#F4F7FA",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    successInner: {
      backgroundColor: "#fff",
      border: "1px solid #E2EAF0",
      borderRadius: 18,
      padding: "48px 32px",
      textAlign: "center" as const,
      maxWidth: 380,
      margin: "0 auto",
    },
    successEmoji: {
      fontSize: 52,
      marginBottom: 16,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: 700,
      color: "#111827",
      margin: "0 0 8px",
    },
    successSub: {
      fontSize: 14,
      color: "#6B7280",
      marginBottom: 24,
    },
    dashLink: {
      display: "inline-block",
      backgroundColor: "#1B68B4",
      color: "#fff",
      textDecoration: "none",
      borderRadius: 10,
      padding: "12px 28px",
      fontSize: 14,
      fontWeight: 600,
    },
    errorMsg: {
      color: "#EF4444",
      fontSize: 13,
      marginTop: 8,
    },
  };

  if (success) {
    return (
      <div style={styles.successCard}>
        <div style={styles.successInner}>
          <div style={styles.successEmoji}>🎉</div>
          <h2 style={styles.successTitle}>Request Sent!</h2>
          <p style={styles.successSub}>
            Your trainer has been notified and will confirm your session shortly.
          </p>
          <Link href="/client" style={styles.dashLink}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.maxWidth}>
        <Link href="/client" style={styles.backLink}>
          ← Dashboard
        </Link>
        <h1 style={styles.headerTitle}>Book a Session</h1>
        <p style={styles.headerSub}>with {trainerName}</p>

        {sessionsRemaining !== null && (
          <div
            style={{
              ...styles.sessionCard,
              border: sessionsRemaining <= 2 ? "1px solid #FCA5A5" : "1px solid #E2EAF0",
            }}
          >
            <div>
              <div style={styles.sessionCardLabel}>Sessions Remaining</div>
              <div
                style={{
                  ...styles.sessionCardCount,
                  color: sessionsRemaining <= 2 ? "#EF4444" : "#111827",
                }}
              >
                {sessionsRemaining}
              </div>
              <div style={styles.sessionCardSub}>pre-paid sessions left</div>
            </div>
          </div>
        )}

        {sessionsRemaining === null && (
          <div style={styles.payBanner}>
            Pay-as-you-go — your trainer will handle payment after each session.
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
            Loading available times…
          </div>
        )}

        {!loading && slots.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyEmoji}>😴</div>
            <p style={styles.emptyTitle}>No open slots right now</p>
            <p style={styles.emptySub}>
              Check back soon — your trainer will add more availability shortly.
            </p>
          </div>
        )}

        {!loading &&
          Object.entries(byDate).map(([date, dateSlots]) => (
            <div key={date} style={styles.dateCard}>
              <div style={styles.dateLabel}>{formatDate(date)}</div>
              {dateSlots.map((slot) => (
                <div
                  key={slot.id}
                  style={styles.slotRow}
                  onClick={() => { setBooking(slot); setBookingNote(""); }}
                >
                  <span style={styles.slotTime}>
                    {formatTime(slot.start_time)} – {formatTime(addOneHour(slot.start_time))}
                  </span>
                  <span style={styles.bookBtn}>Book →</span>
                </div>
              ))}
            </div>
          ))}
      </div>

      {booking && (
        <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setBooking(null); }}>
          <div style={styles.sheet}>
            <div style={styles.sheetTitle}>Confirm Booking</div>
            <div style={styles.sheetSub}>
              {formatDate(booking.available_date)} at {formatTime(booking.start_time)}
            </div>
            <label style={styles.noteLabel}>Add a note (optional)</label>
            <textarea
              style={styles.noteInput}
              rows={3}
              placeholder="e.g. focus on upper body, or any injuries to note…"
              value={bookingNote}
              onChange={(e) => setBookingNote(e.target.value)}
            />
            {error && <div style={styles.errorMsg}>{error}</div>}
            <button style={styles.confirmBtn} onClick={confirmBooking} disabled={saving}>
              {saving ? "Sending Request…" : "Request Session"}
            </button>
            <button style={styles.cancelSheetBtn} onClick={() => setBooking(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
