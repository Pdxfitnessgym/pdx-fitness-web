"use client";
import { useState, useEffect, useRef } from "react";
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

type FoodResult = {
  id: string;
  name: string;
  brand: string;
  calories_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
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
  const [logMode, setLogMode] = useState<"search" | "manual">("search");
  const [logName, setLogName] = useState("");
  const [logType, setLogType] = useState("lunch");
  const [logCals, setLogCals] = useState("");
  const [logProtein, setLogProtein] = useState("");
  const [logCarbs, setLogCarbs] = useState("");
  const [logFat, setLogFat] = useState("");
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Food database search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [portionAmt, setPortionAmt] = useState("100");
  const [portionUnit, setPortionUnit] = useState<"g" | "oz">("g");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

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

  function handleSearchInput(q: string) {
    setSearchQuery(q);
    setSelectedFood(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => doSearch(q), 500);
  }

  async function doSearch(q: string) {
    setSearching(true);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&fields=id,product_name,brands,nutriments&page_size=12`
      );
      const data = await res.json();
      const results: FoodResult[] = (data.products ?? [])
        .filter((p: Record<string, unknown>) => p.product_name)
        .map((p: Record<string, unknown>) => {
          const n = (p.nutriments ?? {}) as Record<string, number>;
          return {
            id: String(p.id ?? p._id ?? Math.random()),
            name: String(p.product_name),
            brand: String(p.brands ?? ""),
            calories_100g: n["energy-kcal_100g"] ?? null,
            protein_100g: n["proteins_100g"] ?? null,
            carbs_100g: n["carbohydrates_100g"] ?? null,
            fat_100g: n["fat_100g"] ?? null,
          };
        });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  async function lookupBarcode(barcode: string) {
    setSearching(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const n = (p.nutriments ?? {}) as Record<string, number>;
        const food: FoodResult = {
          id: barcode,
          name: p.product_name || "Unknown product",
          brand: p.brands || "",
          calories_100g: n["energy-kcal_100g"] ?? null,
          protein_100g: n["proteins_100g"] ?? null,
          carbs_100g: n["carbohydrates_100g"] ?? null,
          fat_100g: n["fat_100g"] ?? null,
        };
        setSearchResults([food]);
        setSearchQuery(food.name);
      } else {
        setSearchResults([]);
        alert("Product not found in database.");
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  async function handleBarcodeImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!("BarcodeDetector" in window)) {
      alert("Barcode scanning isn't supported on this browser. Try typing the barcode number or food name.");
      return;
    }
    const img = await createImageBitmap(file);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code"] });
    const barcodes = await detector.detect(img);
    if (barcodes.length > 0) {
      await lookupBarcode(barcodes[0].rawValue);
    } else {
      alert("No barcode found in the image. Try again with better lighting.");
    }
    e.target.value = "";
  }

  function selectFood(food: FoodResult) {
    setSelectedFood(food);
    setSearchQuery(food.name);
    setSearchResults([]);
    applyPortion(food, portionAmt, portionUnit);
  }

  function applyPortion(food: FoodResult, amt: string, unit: "g" | "oz") {
    const grams = unit === "oz" ? parseFloat(amt) * 28.3495 : parseFloat(amt);
    if (!grams || isNaN(grams)) { setLogCals(""); setLogProtein(""); setLogCarbs(""); setLogFat(""); return; }
    const factor = grams / 100;
    setLogCals(food.calories_100g != null ? String(Math.round(food.calories_100g * factor)) : "");
    setLogProtein(food.protein_100g != null ? String(Math.round(food.protein_100g * factor)) : "");
    setLogCarbs(food.carbs_100g != null ? String(Math.round(food.carbs_100g * factor)) : "");
    setLogFat(food.fat_100g != null ? String(Math.round(food.fat_100g * factor)) : "");
  }

  function handlePortionChange(amt: string, unit: "g" | "oz") {
    setPortionAmt(amt);
    setPortionUnit(unit);
    if (selectedFood) applyPortion(selectedFood, amt, unit);
  }

  function resetForm() {
    setLogName(""); setLogType("lunch"); setLogCals(""); setLogProtein(""); setLogCarbs(""); setLogFat("");
    setSearchQuery(""); setSearchResults([]); setSelectedFood(null); setPortionAmt("100"); setPortionUnit("g");
  }

  async function addFoodLog(e: React.FormEvent) {
    e.preventDefault();
    const name = logMode === "search" ? (selectedFood?.name ?? searchQuery).trim() : logName.trim();
    if (!name || !userId) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("food_logs")
      .insert({
        client_id: userId,
        logged_date: today,
        meal_type: logType,
        food_name: name,
        calories: parseInt(logCals) || null,
        protein_g: parseInt(logProtein) || null,
        carbs_g: parseInt(logCarbs) || null,
        fat_g: parseInt(logFat) || null,
      })
      .select()
      .single();

    if (data) setTodayLogs(prev => [...prev, data as FoodLog]);
    resetForm();
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

  const formName = logMode === "search" ? (selectedFood?.name ?? searchQuery).trim() : logName.trim();

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
            onClick={() => { setAddingLog(v => !v); resetForm(); }}
            style={{ width: "100%", padding: "13px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginTop: 4 }}
          >
            + Log Food
          </button>
        </div>

        {/* Log food form */}
        {addingLog && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 14 }}>Log Food</div>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 0, background: "#F4F7FA", borderRadius: 10, padding: 3, marginBottom: 16 }}>
              {(["search", "manual"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setLogMode(m); resetForm(); }}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: 8,
                    border: "none",
                    background: logMode === m ? "#fff" : "transparent",
                    color: logMode === m ? "#0D1827" : "#6B7A8D",
                    fontWeight: logMode === m ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: logMode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {m === "search" ? "🔍 Search Database" : "✏️ Enter Manually"}
                </button>
              ))}
            </div>

            <form onSubmit={addFoodLog} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {logMode === "search" ? (
                <>
                  {/* Search input + barcode button */}
                  <div>
                    <label style={labelStyle}>Food Name or Brand</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => handleSearchInput(e.target.value)}
                        placeholder="e.g. chicken breast, greek yogurt…"
                        style={{ ...inputStyle, flex: 1 }}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => barcodeInputRef.current?.click()}
                        title="Scan barcode"
                        style={{ flexShrink: 0, padding: "0 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 20, cursor: "pointer" }}
                      >
                        📷
                      </button>
                      <input
                        ref={barcodeInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={handleBarcodeImage}
                      />
                    </div>
                  </div>

                  {/* Search results */}
                  {searching && (
                    <div style={{ fontSize: 13, color: "#6B7A8D", textAlign: "center", padding: "8px 0" }}>Searching…</div>
                  )}
                  {searchResults.length > 0 && !selectedFood && (
                    <div style={{ border: "1px solid #E2EAF0", borderRadius: 10, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
                      {searchResults.map((food, i) => (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => selectFood(food)}
                          style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            padding: "10px 14px",
                            background: "#fff",
                            border: "none",
                            borderBottom: i < searchResults.length - 1 ? "1px solid #F4F7FA" : "none",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#0D1827" }}>{food.name}</span>
                          {food.brand && <span style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>{food.brand}</span>}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            {food.calories_100g != null && <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>{Math.round(food.calories_100g)} kcal</span>}
                            {food.protein_100g != null && <span style={{ fontSize: 11, color: "#1B68B4", fontWeight: 600 }}>P {Math.round(food.protein_100g)}g</span>}
                            {food.carbs_100g != null && <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>C {Math.round(food.carbs_100g)}g</span>}
                            {food.fat_100g != null && <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>F {Math.round(food.fat_100g)}g</span>}
                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>per 100g</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected food + portion */}
                  {selectedFood && (
                    <div style={{ background: "#F0FDF9", border: "1.5px solid #2DC4B8", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{selectedFood.name}</div>
                          {selectedFood.brand && <div style={{ fontSize: 12, color: "#6B7A8D" }}>{selectedFood.brand}</div>}
                        </div>
                        <button type="button" onClick={() => { setSelectedFood(null); setSearchQuery(""); setSearchResults([]); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9CA3AF" }}>✕</button>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label style={labelStyle}>Portion Size</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="number"
                            min="1"
                            value={portionAmt}
                            onChange={e => handlePortionChange(e.target.value, portionUnit)}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button type="button" onClick={() => handlePortionChange(portionAmt, portionUnit === "g" ? "oz" : "g")}
                            style={{ flexShrink: 0, padding: "0 18px", borderRadius: 10, border: "2px solid #2DC4B8", background: "#fff", color: "#2DC4B8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                            {portionUnit}
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 6 }}>
                          Common: {" "}
                          {[["1 oz", "1", "oz"], ["3 oz", "3", "oz"], ["4 oz", "4", "oz"], ["6 oz", "6", "oz"], ["100g", "100", "g"], ["200g", "200", "g"]].map(([label, amt, unit]) => (
                            <button key={label} type="button" onClick={() => handlePortionChange(amt, unit as "g" | "oz")}
                              style={{ marginRight: 6, marginBottom: 4, fontSize: 12, padding: "3px 9px", borderRadius: 20, border: "1px solid #E2EAF0", background: "#fff", color: "#1B68B4", cursor: "pointer", fontWeight: 600 }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
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
              )}

              {/* Meal type */}
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

              {/* Macros (auto-filled from search or manual) */}
              <div>
                <label style={labelStyle}>
                  Macros {logMode === "search" && selectedFood ? <span style={{ fontWeight: 400, color: "#2DC4B8" }}>(auto-calculated)</span> : null}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Calories", val: logCals, set: setLogCals, color: "#F59E0B" },
                    { label: "Protein (g)", val: logProtein, set: setLogProtein, color: "#1B68B4" },
                    { label: "Carbs (g)", val: logCarbs, set: setLogCarbs, color: "#10B981" },
                    { label: "Fat (g)", val: logFat, set: setLogFat, color: "#EF4444" },
                  ].map(({ label, val, set, color }) => (
                    <div key={label}>
                      <label style={{ ...labelStyle, color }}>{label}</label>
                      <input
                        type="number"
                        min="0"
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder="0"
                        style={{ ...inputStyle, borderColor: val ? color + "88" : "#E2EAF0" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setAddingLog(false); resetForm(); }}
                  style={{ flex: 1, padding: "13px", borderRadius: 12, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 700, fontSize: 15, border: "1px solid #E2EAF0", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formName}
                  style={{ flex: 2, padding: "13px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: saving || !formName ? 0.5 : 1 }}
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
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Today&apos;s Log</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayLogs.map(log => (
                <div key={log.id} style={{ ...cardStyle, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                    </div>
                    <button
                      onClick={() => deleteLog(log.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 18, padding: 4, flexShrink: 0 }}
                      aria-label="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                  {(log.calories != null || log.protein_g != null || log.carbs_g != null || log.fat_g != null) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {log.calories != null && <span style={macroPill("#F59E0B")}>{log.calories} kcal</span>}
                      {log.protein_g != null && <span style={macroPill("#1B68B4")}>P {log.protein_g}g</span>}
                      {log.carbs_g != null && <span style={macroPill("#10B981")}>C {log.carbs_g}g</span>}
                      {log.fat_g != null && <span style={macroPill("#EF4444")}>F {log.fat_g}g</span>}
                    </div>
                  )}
                </div>
              ))}

              {/* Macro totals row */}
              <div style={{ ...cardStyle, background: "#F4F7FA", padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Daily Total</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Calories", value: totalCals, unit: "kcal", color: "#F59E0B", target: plan?.calories_target ?? null },
                    { label: "Protein", value: totalProtein, unit: "g", color: "#1B68B4", target: plan?.protein_target ?? null },
                    { label: "Carbs", value: totalCarbs, unit: "g", color: "#10B981", target: plan?.carbs_target ?? null },
                    { label: "Fat", value: totalFat, unit: "g", color: "#EF4444", target: plan?.fat_target ?? null },
                  ].map(({ label, value, unit, color, target }) => {
                    const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null;
                    return (
                      <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "10px 8px", border: `2px solid ${color}22`, textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A8D", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}<span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>{unit}</span></div>
                        {pct !== null && (
                          <div style={{ fontSize: 11, color: pct >= 100 ? color : "#9CA3AF", fontWeight: 600, marginTop: 2 }}>{pct}%</div>
                        )}
                        {target != null && (
                          <div style={{ height: 4, background: "#E2EAF0", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
                            <div style={{ height: "100%", width: `${pct ?? 0}%`, background: color, borderRadius: 99 }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
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
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer hasn&apos;t set up a nutrition plan yet</div>
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

function macroPill(color: string): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    color,
    background: color + "18",
    borderRadius: 20,
    padding: "3px 10px",
    border: `1px solid ${color}44`,
  };
}
