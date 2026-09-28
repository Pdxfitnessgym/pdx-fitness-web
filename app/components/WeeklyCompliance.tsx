"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ComplianceGrid } from "@/app/components/InsightsCharts";
import { gymToday } from "@/lib/time";

// The client's own view of the Mon–Sun grid the trainer sees on their page.
// Days are bucketed in Portland time so a late-evening workout counts today.
export function WeeklyCompliance() {
  const [rows, setRows] = useState<{ label: string; days: boolean[] }[]>([]);
  const [rangeLabel, setRangeLabel] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Monday of the current week, anchored at noon so no DST hop can shift it
      const today = new Date(gymToday() + "T12:00:00");
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

      const keys: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        keys.push(gymToday(d));
      }
      const indexOf = (key: string) => keys.indexOf(key);

      const [wlRes, hlRes, habitRes] = await Promise.all([
        supabase.from("workout_logs").select("completed_at")
          .eq("client_id", user.id).not("completed_at", "is", null)
          .gte("completed_at", new Date(monday.getTime() - 86400000).toISOString()),
        supabase.from("habit_logs").select("logged_date")
          .eq("client_id", user.id).gte("logged_date", keys[0]),
        supabase.from("habits").select("id")
          .eq("client_id", user.id).eq("is_active", true).limit(1),
      ]);

      const blank = () => [false, false, false, false, false, false, false];

      const workouts = blank();
      for (const w of wlRes.data ?? []) {
        const i = indexOf(gymToday(new Date(w.completed_at as string)));
        if (i >= 0) workouts[i] = true;
      }

      const next = [{ label: "Workouts", days: workouts }];

      // Only show the habits row to people who actually keep habits
      if (habitRes.data?.length) {
        const habits = blank();
        for (const h of hlRes.data ?? []) {
          const i = indexOf(h.logged_date as string);
          if (i >= 0) habits[i] = true;
        }
        next.push({ label: "Habits", days: habits });
      }

      const fmt = (k: string) =>
        new Date(k + "T12:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short" });
      setRangeLabel(`${fmt(keys[0])} – ${fmt(keys[6])}`);
      setRows(next);
    }
    load();
  }, []);

  if (rows.length === 0) return null;
  return <ComplianceGrid title="Your Week" rangeLabel={rangeLabel} rows={rows} />;
}
