"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

type WorkoutDay = { date: string; name: string; workoutId: string; completed: boolean };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function workoutDate(startDate: string, weekNumber: number, dayOfWeek: number): string {
  const start = new Date(startDate + "T12:00:00");
  const weekOffset = (weekNumber - 1) * 7;
  const startDow = start.getDay();
  const dayOffset = (dayOfWeek - startDow + 7) % 7;
  const d = new Date(start);
  d.setDate(d.getDate() + weekOffset + dayOffset);
  return d.toISOString().split("T")[0];
}

export default function CalendarPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [calToken, setCalToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<WorkoutDay | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [cpRes, logsRes, tokenRes] = await Promise.all([
        supabase
          .from("client_programs")
          .select("start_date, programs(name, workouts(id, name, day_of_week, week_number))")
          .eq("client_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("workout_logs")
          .select("workout_id, completed_at")
          .eq("client_id", user.id),
        fetch("/api/calendar/subscribe").then(r => r.json()),
      ]);

      setCalToken(tokenRes?.token ?? null);

      const cp = cpRes.data;
      if (!cp) { setLoading(false); return; }

      const program = cp.programs as unknown as { name: string; workouts: { id: string; name: string; day_of_week: number; week_number: number }[] } | null;
      if (!program) { setLoading(false); return; }

      const completedIds = new Set((logsRes.data ?? []).map(l => l.workout_id));

      const days: WorkoutDay[] = program.workouts.map(w => ({
        date: workoutDate(cp.start_date, w.week_number, w.day_of_week),
        name: w.name,
        workoutId: w.id,
        completed: completedIds.has(w.id),
      }));

      setWorkoutDays(days);
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

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = today.toISOString().split("T")[0];

  const workoutMap: Record<string, WorkoutDay> = {};
  for (const w of workoutDays) workoutMap[w.date] = w;

  function getCalUrl(scheme: "webcal" | "https") {
    if (!calToken) return "";
    return `${scheme}://${window.location.host}/api/calendar/${calToken}`;
  }

  function copyGoogleUrl() {
    if (!calToken) return;
    navigator.clipboard.writeText(getCalUrl("https"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Calendar</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Month nav */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E2EAF0" }}>
            <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 18, cursor: "pointer" }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0D1827" }}>{MONTHS[viewMonth]} {viewYear}</div>
            <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 18, cursor: "pointer" }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "10px 12px 4px" }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, padding: "4px 12px 16px" }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const workout = workoutMap[dateStr];
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;

              return (
                <button
                  key={i}
                  onClick={() => workout ? setSelected(workout) : undefined}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 10,
                    border: "none",
                    background: workout?.completed ? "#D1FAE5"
                      : workout ? "#EFF6FF"
                      : "transparent",
                    cursor: workout ? "pointer" : "default",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    padding: 2,
                    position: "relative",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isToday ? "#1B68B4" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 800 : workout ? 700 : 400, color: isToday ? "#fff" : workout ? (workout.completed ? "#059669" : "#1B68B4") : isPast ? "#9CA3AF" : "#0D1827" }}>
                      {day}
                    </span>
                  </div>
                  {workout && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: workout.completed ? "#10B981" : "#1B68B4" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, padding: "0 16px 16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1B68B4" }} />
              <span style={{ fontSize: 12, color: "#6B7A8D" }}>Scheduled</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
              <span style={{ fontSize: 12, color: "#6B7A8D" }}>Completed</span>
            </div>
          </div>
        </div>

        {/* Selected workout */}
        {selected && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, color: "#6B7A8D" }}>{new Date(selected.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1827", marginTop: 4 }}>{selected.name}</div>
                {selected.completed && <div style={{ fontSize: 13, color: "#10B981", fontWeight: 600, marginTop: 4 }}>✓ Completed</div>}
              </div>
              <button onClick={() => setSelected(null)} style={{ color: "#9CA3AF", background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            {!selected.completed && (
              <Link href={`/client/workouts/${selected.workoutId}`} style={{ display: "block", marginTop: 14, padding: "12px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, textAlign: "center", textDecoration: "none" }}>
                Start Workout →
              </Link>
            )}
          </div>
        )}

        {/* Calendar sync */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>Sync to your calendar</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 16 }}>Add this once — your workouts stay updated automatically. Tapping again just adds a duplicate calendar.</div>

          {calToken && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D", marginBottom: 6 }}>Your calendar URL</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", fontSize: 11, color: "#374151", wordBreak: "break-all", fontFamily: "monospace" }}>
                  {getCalUrl("webcal")}
                </div>
                <button
                  onClick={copyGoogleUrl}
                  style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 10, background: copied ? "#10B981" : "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Apple Calendar — tap to open */}
            {calToken ? (
              <a
                href={getCalUrl("webcal")}
                style={{ padding: "14px 16px", borderRadius: 12, background: "#000", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}
              >
                <span style={{ fontSize: 22 }}>📅</span>
                <div>
                  <div>Add to Apple Calendar</div>
                  <div style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>Subscribe once — it updates on its own</div>
                </div>
              </a>
            ) : null}

            {/* Manual instructions */}
            <div style={{ background: "#F4F7FA", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827", marginBottom: 8 }}>Manual subscription (Apple or Google)</div>
              <div style={{ fontSize: 13, color: "#6B7A8D", lineHeight: 1.7 }}>
                1. Tap <strong>Copy</strong> above<br />
                2. <strong>Apple:</strong> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the URL<br />
                <strong>Google:</strong> calendar.google.com → Other calendars + → From URL → paste
              </div>
            </div>
          </div>
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>}
        {!loading && workoutDays.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "40px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No program assigned</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer will assign a program to populate your calendar</div>
          </div>
        )}
      </div>

      <ClientBottomNav />
    </div>
  );
}
