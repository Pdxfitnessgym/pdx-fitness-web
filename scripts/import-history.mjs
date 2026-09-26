#!/usr/bin/env node
/**
 * Import historical workout data (e.g. exported from Trainerize) so clients keep
 * their past sessions and PRs.
 *
 * set_logs.exercise_id and workout_logs.workout_id are both NOT NULL, so history
 * can't be loaded as loose numbers — this recreates the minimum structure:
 * one private workout per distinct historical workout name, one exercise row per
 * distinct exercise in it, then a workout_log per session and set_logs beneath.
 * PRs and the progress charts read straight from those, so they light up with no
 * further work.
 *
 * Expected CSV columns (header row required, order irrelevant, extras ignored):
 *   client_email, date, workout_name, exercise_name, set_number, reps, weight_lbs
 *
 *   date        — anything Date can parse (2026-03-14, 3/14/2026, ...)
 *   reps        — text, so "12" and "0:30" both work
 *   weight_lbs  — number, blank for bodyweight
 *
 * Usage:
 *   node scripts/import-history.mjs history.csv --dry-run   # preview, writes nothing
 *   node scripts/import-history.mjs history.csv             # import
 *
 * Re-running is safe: sessions already imported for the same client+workout+date
 * are skipped rather than duplicated.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const IMPORT_TAG = "Imported history";

const file = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!file) {
  console.error("Usage: node scripts/import-history.mjs <file.csv> [--dry-run]");
  process.exit(1);
}

// --- env ---------------------------------------------------------------
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- CSV ---------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

const raw = parseCsv(fs.readFileSync(file, "utf8"));
const header = raw[0].map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
const need = ["client_email", "date", "exercise_name"];
for (const col of need) {
  if (!header.includes(col)) {
    console.error(`Missing required column "${col}". Found: ${header.join(", ")}`);
    process.exit(1);
  }
}

const records = raw.slice(1).map(r => {
  const o = {};
  header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
  return o;
}).filter(r => r.client_email && r.date && r.exercise_name);

console.log(`Parsed ${records.length} rows from ${file}${dryRun ? "  (DRY RUN — nothing will be written)" : ""}\n`);

// --- group -------------------------------------------------------------
const byClient = {};
for (const r of records) {
  const email = r.client_email.toLowerCase();
  const workoutName = r.workout_name?.trim() || "Imported Workout";
  const day = new Date(r.date);
  if (isNaN(day.getTime())) { console.warn(`  ! unparseable date "${r.date}" — row skipped`); continue; }
  const dayKey = day.toISOString().slice(0, 10);

  ((byClient[email] ??= {})[workoutName] ??= {});
  (byClient[email][workoutName][dayKey] ??= []).push({
    exercise: r.exercise_name.trim(),
    set_number: parseInt(r.set_number) || 1,
    reps: r.reps?.trim() || null,
    weight: r.weight_lbs ? Number(r.weight_lbs) : null,
    at: day,
  });
}

// --- import ------------------------------------------------------------
let created = { workouts: 0, exercises: 0, sessions: 0, sets: 0, skipped: 0 };

for (const [email, workouts] of Object.entries(byClient)) {
  const { data: profile } = await svc
    .from("profiles").select("id, full_name, trainer_id").eq("email", email).maybeSingle();

  if (!profile) { console.warn(`SKIP  no client account for ${email}`); continue; }
  console.log(`${profile.full_name ?? email}`);

  for (const [workoutName, days] of Object.entries(workouts)) {
    const exerciseNames = [...new Set(Object.values(days).flat().map(s => s.exercise))];

    // one private workout holding this historical routine
    let workoutId;
    const { data: existingWorkout } = await svc
      .from("workouts").select("id")
      .eq("trainer_id", profile.trainer_id)
      .eq("name", `${workoutName} (imported)`)
      .maybeSingle();

    if (existingWorkout) {
      workoutId = existingWorkout.id;
    } else if (!dryRun) {
      const { data: w, error } = await svc.from("workouts").insert({
        trainer_id: profile.trainer_id,
        name: `${workoutName} (imported)`,
        program_id: null,
        is_standalone: true,
        is_private: true,
        day_of_week: 0,
        week_number: 0,
        description: IMPORT_TAG,
      }).select("id").single();
      if (error) { console.error(`  ! ${error.message}`); continue; }
      workoutId = w.id;
      created.workouts++;
      await svc.from("client_workout_assignments")
        .insert({ client_id: profile.id, workout_id: workoutId, assigned_by: profile.trainer_id });
    } else {
      created.workouts++;
    }

    // one exercise row per distinct movement — this is what PRs read through
    const exerciseIds = {};
    for (const [i, name] of exerciseNames.entries()) {
      if (!workoutId) { exerciseIds[name] = null; created.exercises++; continue; }
      const { data: existing } = await svc
        .from("exercises").select("id").eq("workout_id", workoutId).eq("name", name).maybeSingle();
      if (existing) { exerciseIds[name] = existing.id; continue; }
      if (dryRun) { created.exercises++; continue; }
      const { data: ex, error } = await svc.from("exercises").insert({
        workout_id: workoutId, name, sets: 3, reps: "—", rest_seconds: 60, order: i,
      }).select("id").single();
      if (error) { console.error(`  ! ${error.message}`); continue; }
      exerciseIds[name] = ex.id;
      created.exercises++;
    }

    for (const [dayKey, sets] of Object.entries(days)) {
      const completedAt = sets[0].at.toISOString();

      if (workoutId) {
        const { data: dupe } = await svc.from("workout_logs")
          .select("id").eq("client_id", profile.id).eq("workout_id", workoutId)
          .gte("completed_at", `${dayKey}T00:00:00Z`).lt("completed_at", `${dayKey}T23:59:59Z`)
          .maybeSingle();
        if (dupe) { created.skipped++; continue; }
      }

      if (dryRun) { created.sessions++; created.sets += sets.length; continue; }

      const { data: log, error: logErr } = await svc.from("workout_logs").insert({
        client_id: profile.id,
        workout_id: workoutId,
        completed_at: completedAt,
        notes: IMPORT_TAG,
      }).select("id").single();
      if (logErr) { console.error(`  ! ${logErr.message}`); continue; }
      created.sessions++;

      const rows = sets
        .filter(s => exerciseIds[s.exercise])
        .map(s => ({
          client_id: profile.id,
          workout_log_id: log.id,
          exercise_id: exerciseIds[s.exercise],
          set_number: s.set_number,
          reps_completed: s.reps,
          weight_lbs: s.weight,
          side: "both",
        }));
      if (rows.length) {
        const { error: setErr } = await svc.from("set_logs").insert(rows);
        if (setErr) console.error(`  ! ${setErr.message}`);
        else created.sets += rows.length;
      }
    }

    console.log(`  ${workoutName}: ${Object.keys(days).length} sessions, ${exerciseNames.length} exercises`);
  }
}

console.log(`\n${dryRun ? "Would create" : "Created"}:`);
console.log(`  ${created.workouts} workouts, ${created.exercises} exercises`);
console.log(`  ${created.sessions} sessions, ${created.sets} sets`);
if (created.skipped) console.log(`  ${created.skipped} sessions already imported — skipped`);
