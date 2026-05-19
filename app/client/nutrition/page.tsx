"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Meal = {
  id: string;
  name: string;
  meal_type: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  ingredients: string | null;
  instructions: string | null;
};

type Plan = {
  id: string;
  name: string;
  calories_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  meals: Meal[];
};

type FoodLog = {
  id: string;
  meal_type: string;
  food_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_date: string;
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  pre_workout: "Pre-Workout",
  post_workout: "Post-Workout",
};

const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: "#F59E0B",
  lunch: "#10B981",
  dinner: "#1B68B4",
  snack: "#8B5CF6",
  pre_workout: "#2DC4B8",
  post_workout: "#2DC4B8",
};

const MEAL_TYPE_ORDER = ["breakfast", "pre_workout", "lunch", "snack", "dinner", "post_workout"];

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7A8D" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>
          {value}
          {target != null && <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 400 }}> / {target}</span>}
        </span>
      </div>
      {target != null && (
        <div style={{ height: 6, background: "#E2EAF0", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.4s" }} />
        </div>
      )}
    </div>
  );
}

export default function NutritionPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [todayLogs, setTodayLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingLog, setAddingLog] = useState(false);
  const [logName, setLogName] = useState("");
  const [logType, setLogType] = useState("lunch");
  const [logCals, setLogCals] = useState("");
  const [logProtein, setLogProtein] = useState("");
  const [logCarbs, setLogCarbs] = useState("");
  const [logFat, setLogFat] = useState("");
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const todayFormatted = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [planRes, logsRes] = await Promise.all([
        supabase
          .from("client_meal_plans")
          .select("meal_plans(id, name, calories_target, protein_target, carbs_target, fat_target, meals(id, name, meal_type, description, calories, protein_g, carbs_g, fat_g, ingredients, instructions))")
          .eq("client_id", user.id)
          .eq("is_active", true)
          .limit(1),
        supabase
          .from("food_logs")
          .select("id, meal_type, food_name, calories, protein_g, carbs_g, fat_g, logged_date")
          .eq("client_id", user.id)
          .eq("logged_date", today),
      ]);

      if (planRes.data && planRes.data.length > 0) {
        const raw = planRes.data[0].meal_plans as unknown as Plan;
        if (raw) setPlan(raw);
      }

      if (logsRes.data) setTodayLogs(logsRes.data as FoodLog[]);
      setLoading(false);
    }
    load();
  }, [today]);

  const totalCals = todayLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
  const totalProtein = todayLogs.reduce((s, l) => s + (l.protein_g ?? 0), 0);
  const totalCarbs = todayLogs.reduce((s, l) => s + (l.carbs_g ?? 0), 0);
  const totalFat = todayLogs.reduce((s, l) => s + (l.fat_g ?? 0), 0);

  async function addFoodLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logName.trim() || !userId) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("food_logs")
      .insert({
        client_id: userId,
        logged_date: today,
        meal_type: logType,
        food_name: logName.trim(),
        calories: parseInt(logCals) || null,
        protein_g: parseInt(logProtein) || null,
        carbs_g: parseInt(logCarbs) || null,
        fat_g: parseInt(logFat) || null,
      })
      .select()
      .single();

    if (data) setTodayLogs(prev => [...prev, data as FoodLog]);
    setLogName(""); setLogType("lunch"); setLogCals(""); setLogProtein(""); setLogCarbs(""); setLogFat("");
    setAddingLog(false);
    setSaving(false);
  }

  async function deleteLog(id: string) {
    const supabase = createClient();
    await supabase.from("food_logs").delete().eq("id", id);
    setTodayLogs(prev => prev.filter(l => l.id !== id));
  }

  const groupedMeals = plan
    ? MEAL_TYPE_ORDER.reduce<Record<string, Meal[]>>((acc, type) => {
        const meals = plan.meals.filter(m => m.meal_type === type);
        if (meals.length) acc[type] = meals;
        return acc;
      }, {})
    : {};

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#6B7A8D", fontSize: 15 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <a href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</a>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Nutrition</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Today's Macros card */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
            {todayFormatted}
          </div>
          <MacroBar label="Calories (kcal)" value={totalCals} target={plan?.calories_target ?? null} color="#F59E0B" />
          <MacroBar label="Protein (g)" value={totalProtein} target={plan?.protein_target ?? null} color="#1B68B4" />
          <MacroBar label="Carbs (g)" value={totalCarbs} target={plan?.carbs_target ?? null} color="#10B981" />
          <MacroBar label="Fat (g)" value={totalFat} target={plan?.fat_target ?? null} color="#EF4444" />
          <button
            onClick={() => setAddingLog(v => !v)}
            style={{ width: "100%", padding: "13px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginTop: 4 }}
          >
            + Log Food
          </button>
        </div>

        {/* Log food form */}
        {addingLog && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 14 }}>Log Food</div>
            <form onSubmit={addFoodLog} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Food Name</label>
                <input
                  type="text"
                  required
                  value={logName}
                  onChange={e => setLogName(e.target.value)}
                  placeholder="e.g. Chicken breast"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Meal Type</label>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {Object.entries(MEAL_TYPE_LABELS).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLogType(val)}
                      style={{
                        flexShrink: 0,
                        padding: "7px 14px",
                        borderRadius: 20,
                        border: `2px solid ${logType === val ? MEAL_TYPE_COLORS[val] : "#E2EAF0"}`,
                        background: logType === val ? MEAL_TYPE_COLORS[val] + "18" : "#F4F7FA",
                        color: logType === val ? MEAL_TYPE_COLORS[val] : "#6B7A8D",
                        fontWeight: logType === val ? 700 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Calories", val: logCals, set: setLogCals },
                  { label: "Protein (g)", val: logProtein, set: setLogProtein },
                  { label: "Carbs (g)", val: logCarbs, set: setLogCarbs },
                  { label: "Fat (g)", val: logFat, set: setLogFat },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      type="number"
                      min="0"
                      value={val}
                      onChange={e => set(e.target.value)}
                      placeholder="optional"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAddingLog(false)}
                  style={{ flex: 1, padding: "13px", borderRadius: 12, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 700, fontSize: 15, border: "1px solid #E2EAF0", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !logName.trim()}
                  style={{ flex: 2, padding: "13px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: saving || !logName.trim() ? 0.5 : 1 }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Today's food log */}
        {todayLogs.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Today's Log</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayLogs.map(log => {
                const parts: string[] = [];
                if (log.calories != null) parts.push(`${log.calories} kcal`);
                if (log.protein_g != null) parts.push(`P ${log.protein_g}g`);
                if (log.carbs_g != null) parts.push(`C ${log.carbs_g}g`);
                if (log.fat_g != null) parts.push(`F ${log.fat_g}g`);
                return (
                  <div key={log.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      background: MEAL_TYPE_COLORS[log.meal_type] ?? "#9CA3AF",
                      borderRadius: 20,
                      padding: "3px 9px",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}>
                      {MEAL_TYPE_LABELS[log.meal_type] ?? log.meal_type}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.food_name}</div>
                      {parts.length > 0 && <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>{parts.join(" · ")}</div>}
                    </div>
                    <button
                      onClick={() => deleteLog(log.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 18, padding: 4, flexShrink: 0 }}
                      aria-label="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* My Meal Plan */}
        {plan ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 4, height: 24, background: "#1B68B4", borderRadius: 4, flexShrink: 0 }} />
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1827" }}>{plan.name}</div>
            </div>

            {Object.entries(groupedMeals).map(([type, meals]) => (
              <div key={type} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MEAL_TYPE_COLORS[type] ?? "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  {MEAL_TYPE_LABELS[type] ?? type}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {meals.map(meal => {
                    const isExpanded = expandedMeal === meal.id;
                    const chips: string[] = [];
                    if (meal.calories != null) chips.push(`${meal.calories} kcal`);
                    if (meal.protein_g != null) chips.push(`P ${meal.protein_g}g`);
                    if (meal.carbs_g != null) chips.push(`C ${meal.carbs_g}g`);
                    if (meal.fat_g != null) chips.push(`F ${meal.fat_g}g`);
                    return (
                      <div
                        key={meal.id}
                        style={{ ...cardStyle, cursor: "pointer", border: isExpanded ? `2px solid ${MEAL_TYPE_COLORS[type] ?? "#E2EAF0"}` : "1px solid #E2EAF0" }}
                        onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#fff",
                            background: MEAL_TYPE_COLORS[type] ?? "#9CA3AF",
                            borderRadius: 20,
                            padding: "3px 9px",
                            flexShrink: 0,
                          }}>
                            {MEAL_TYPE_LABELS[type] ?? type}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>{meal.name}</div>
                          </div>
                          <span style={{ color: "#9CA3AF", fontSize: 18, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>⌄</span>
                        </div>
                        {chips.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                            {chips.map(chip => (
                              <span key={chip} style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D", background: "#F4F7FA", borderRadius: 20, padding: "3px 10px", border: "1px solid #E2EAF0" }}>
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                        {isExpanded && (
                          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                            {meal.description && (
                              <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.5 }}>{meal.description}</p>
                            )}
                            {meal.ingredients && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Ingredients</div>
                                <div style={{ background: "#F4F7FA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                  {meal.ingredients}
                                </div>
                              </div>
                            )}
                            {meal.instructions && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Instructions</div>
                                <div style={{ background: "#F4F7FA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                  {meal.instructions}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0D1827", marginBottom: 6 }}>No meal plan assigned</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer hasn't set up a nutrition plan yet</div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E2EAF0", padding: "8px 20px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { label: "Home", href: "/client", icon: "🏠" },
            { label: "Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "Habits", href: "/client/habits", icon: "🌱" },
            { label: "Progress", href: "/client/progress", icon: "📈" },
            { label: "Profile", href: "/client/profile", icon: "👤" },
          ].map(item => (
            <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", padding: "6px 0" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 18,
  border: "1px solid #E2EAF0",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#0D1827",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid #E2EAF0",
  background: "#F4F7FA",
  fontSize: 14,
  color: "#0D1827",
  outline: "none",
  boxSizing: "border-box",
};
