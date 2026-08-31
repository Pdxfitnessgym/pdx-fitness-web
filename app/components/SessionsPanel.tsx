"use client";
import { useState } from "react";
import { updateSessionsPurchased, scheduleSession, updateSessionStatus } from "@/app/actions/sessions";

type Session = {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "completed" | "no_show" | "rescheduled" | "cancelled" | "pending";
  notes: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  no_show: "No Show",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  pending: "Pending",
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: "#1B68B4",
  completed: "#10B981",
  no_show: "#EF4444",
  rescheduled: "#F59E0B",
  cancelled: "#9CA3AF",
  pending: "#8B5CF6",
};

export function SessionsPanel({
  clientId,
  sessionsPurchased,
  completedCount,
  sessions,
}: {
  clientId: string;
  sessionsPurchased: number;
  completedCount: number;
  sessions: Session[];
}) {
  const remaining = sessionsPurchased - completedCount;
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPurchased, setShowPurchased] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const pct = sessionsPurchased > 0 ? Math.max(0, (remaining / sessionsPurchased) * 100) : 0;
  const low = remaining <= 2 && sessionsPurchased > 0;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Sessions</div>
        <button
          onClick={() => setShowPurchased(v => !v)}
          style={{ fontSize: 12, color: "#2DC4B8", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          {showPurchased ? "Cancel" : "Edit Package"}
        </button>
      </div>

      {/* Counter */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 800, color: low ? "#EF4444" : "#0D1827" }}>{remaining}</span>
        <span style={{ fontSize: 15, color: "#6B7A8D" }}>/ {sessionsPurchased} remaining</span>
        {low && <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>⚠️ Running low</span>}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: "#E2EAF0", borderRadius: 99, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: low ? "#EF4444" : "#2DC4B8", borderRadius: 99, transition: "width 0.4s" }} />
      </div>

      {/* Edit package form */}
      {showPurchased && (
        <form
          action={async (fd) => { await updateSessionsPurchased(fd); setShowPurchased(false); }}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <input type="hidden" name="client_id" value={clientId} />
          <input
            type="number"
            name="sessions_purchased"
            min="0"
            defaultValue={sessionsPurchased}
            placeholder="Total sessions"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" }}
          />
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
            Save
          </button>
        </form>
      )}

      {/* Schedule button */}
      <button
        onClick={() => setShowSchedule(v => !v)}
        style={{ width: "100%", padding: "12px", borderRadius: 12, background: showSchedule ? "#F4F7FA" : "#2DC4B8", color: showSchedule ? "#6B7A8D" : "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", marginBottom: showSchedule ? 12 : 0 }}
      >
        {showSchedule ? "Cancel" : "+ Schedule Session"}
      </button>

      {/* Schedule form */}
      {showSchedule && (
        <form
          action={async (fd) => { await scheduleSession(fd); setShowSchedule(false); }}
          style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "#F4F7FA", borderRadius: 12 }}
        >
          <input type="hidden" name="client_id" value={clientId} />
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 }}>Date & Time</label>
            <input
              type="datetime-local"
              name="scheduled_at"
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#fff", fontSize: 14, color: "#0D1827", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 }}>Notes <span style={{ color: "#6B7A8D", fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              name="notes"
              placeholder="e.g. Focus on upper body"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#fff", fontSize: 14, color: "#0D1827", outline: "none" }}
            />
          </div>
          <button type="submit" style={{ padding: "12px", borderRadius: 10, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
            Book Session →
          </button>
        </form>
      )}

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Sessions</div>
          {sessions.map(s => (
            <div key={s.id} style={{ background: "#F8FAFB", borderRadius: 12, padding: "12px 14px", border: "1px solid #E2EAF0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>
                    {new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    <span style={{ fontWeight: 400, color: "#6B7A8D", marginLeft: 6 }}>
                      {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  {s.notes && <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>{s.notes}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[s.status], background: STATUS_COLOR[s.status] + "18", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>

              {/* Status actions — only for non-completed */}
              {s.status === "scheduled" && (
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {(["completed", "no_show", "rescheduled"] as const).map(st => (
                    <form key={st} action={async (fd) => { setUpdatingId(s.id); await updateSessionStatus(fd); setUpdatingId(null); }}>
                      <input type="hidden" name="session_id" value={s.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="status" value={st} />
                      <button
                        type="submit"
                        disabled={updatingId === s.id}
                        style={{
                          padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                          background: st === "completed" ? "#D1FAE5" : st === "no_show" ? "#FEE2E2" : "#FEF3C7",
                          color: st === "completed" ? "#065F46" : st === "no_show" ? "#991B1B" : "#92400E",
                        }}
                      >
                        {st === "completed" ? "✓ Done" : st === "no_show" ? "No Show" : "Reschedule"}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 18,
  border: "1px solid #E2EAF0",
};
