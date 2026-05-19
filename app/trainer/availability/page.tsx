"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Slot = {
  id: string;
  available_date: string;
  start_time: string;
  is_booked: boolean;
};

const HOURS = [
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "19:00", label: "7:00 PM" },
];

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
  const h = hour.toString().padStart(2, "0");
  return `${h}:${minStr || "00"}:00`;
}

const today = new Date().toISOString().split("T")[0];

export default function AvailabilityPage() {
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTime, setNewTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("trainer_availability")
        .select("*")
        .eq("trainer_id", user.id)
        .gte("available_date", today)
        .order("available_date", { ascending: true })
        .order("start_time", { ascending: true });

      setSlots(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function addSlot() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase
      .from("trainer_availability")
      .insert({
        trainer_id: user.id,
        available_date: selectedDate,
        start_time: newTime + ":00",
        is_booked: false,
      })
      .select()
      .single();

    if (!error && data) {
      setSlots((prev) =>
        [...prev, data as Slot].sort((a, b) => {
          if (a.available_date !== b.available_date)
            return a.available_date.localeCompare(b.available_date);
          return a.start_time.localeCompare(b.start_time);
        })
      );
    }
    setSaving(false);
    setAdding(false);
  }

  async function removeSlot(slotId: string) {
    await supabase.from("trainer_availability").delete().eq("id", slotId);
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  const daySlots = slots.filter((s) => s.available_date === selectedDate);

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
    card: {
      backgroundColor: "#fff",
      border: "1px solid #E2EAF0",
      borderRadius: 14,
      padding: 20,
      marginBottom: 20,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: "#111827",
      marginBottom: 14,
    },
    label: {
      fontSize: 13,
      color: "#6B7280",
      marginBottom: 6,
      display: "block",
      fontWeight: 500,
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #E2EAF0",
      borderRadius: 8,
      fontSize: 14,
      color: "#111827",
      backgroundColor: "#F9FAFB",
      boxSizing: "border-box" as const,
      marginBottom: 16,
    },
    slotRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid #F3F4F6",
    },
    slotTime: {
      fontSize: 14,
      fontWeight: 500,
      color: "#111827",
    },
    badgeBooked: {
      backgroundColor: "#FEF3C7",
      color: "#92400E",
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 20,
    },
    removeBtn: {
      background: "none",
      border: "none",
      color: "#EF4444",
      fontSize: 13,
      cursor: "pointer",
      fontWeight: 500,
      padding: "4px 8px",
    },
    addRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
    },
    select: {
      flex: 1,
      padding: "10px 12px",
      border: "1px solid #E2EAF0",
      borderRadius: 8,
      fontSize: 14,
      color: "#111827",
      backgroundColor: "#F9FAFB",
    },
    saveBtn: {
      backgroundColor: "#1B68B4",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "10px 18px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    },
    cancelBtn: {
      background: "none",
      border: "1px solid #E2EAF0",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 14,
      color: "#6B7280",
      cursor: "pointer",
    },
    addSlotBtn: {
      width: "100%",
      border: "2px dashed #1B68B4",
      backgroundColor: "transparent",
      color: "#1B68B4",
      borderRadius: 8,
      padding: "12px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      marginTop: 12,
    },
    dateLabel: {
      fontSize: 13,
      fontWeight: 700,
      color: "#6B7280",
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      marginBottom: 10,
      marginTop: 4,
    },
    chipsRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 8,
      marginBottom: 12,
    },
    chipGreen: {
      backgroundColor: "#D1FAE5",
      color: "#065F46",
      borderRadius: 20,
      padding: "4px 12px",
      fontSize: 13,
      fontWeight: 500,
    },
    chipYellow: {
      backgroundColor: "#FEF3C7",
      color: "#92400E",
      borderRadius: 20,
      padding: "4px 12px",
      fontSize: 13,
      fontWeight: 500,
    },
    emptyState: {
      textAlign: "center" as const,
      padding: "40px 20px",
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
  };

  return (
    <div style={styles.page}>
      <div style={styles.maxWidth}>
        <Link href="/trainer" style={styles.backLink}>
          ← Dashboard
        </Link>
        <h1 style={styles.headerTitle}>My Availability</h1>
        <p style={styles.headerSub}>Set the times clients can book with you</p>

        {/* Card 1: Add Available Times */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Add Available Times</div>

          <label style={styles.label}>Select Date</label>
          <input
            type="date"
            style={styles.input}
            min={today}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          {daySlots.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              {daySlots.map((slot) => (
                <div key={slot.id} style={styles.slotRow}>
                  <span style={styles.slotTime}>
                    {formatTime(slot.start_time)} – {formatTime(addOneHour(slot.start_time))}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {slot.is_booked ? (
                      <span style={styles.badgeBooked}>Booked</span>
                    ) : (
                      <button
                        style={styles.removeBtn}
                        onClick={() => removeSlot(slot.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div style={styles.addRow}>
              <select
                style={styles.select}
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              >
                {HOURS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
              <button style={styles.saveBtn} onClick={addSlot} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button style={styles.cancelBtn} onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button style={styles.addSlotBtn} onClick={() => setAdding(true)}>
              + Add Time Slot
            </button>
          )}
        </div>

        {/* Card 2: Upcoming Availability */}
        {!loading && slots.length > 0 && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Upcoming Availability</div>
            {Object.entries(byDate).map(([date, dateSlots]) => (
              <div key={date}>
                <div style={styles.dateLabel}>{formatDate(date)}</div>
                <div style={styles.chipsRow}>
                  {dateSlots.map((slot) => (
                    <span
                      key={slot.id}
                      style={slot.is_booked ? styles.chipYellow : styles.chipGreen}
                    >
                      {slot.is_booked ? "🔒 " : ""}
                      {formatTime(slot.start_time)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && slots.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyEmoji}>📅</div>
            <p style={styles.emptyTitle}>No availability set</p>
            <p style={styles.emptySub}>Add time slots above so clients can book sessions with you.</p>
          </div>
        )}
      </div>
    </div>
  );
}
