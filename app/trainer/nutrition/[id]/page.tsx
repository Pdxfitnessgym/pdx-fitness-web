"use client";
import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
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
  sort_order: number;
};

type Plan = {
  id: string;
  name: string;
  calories_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
};

type Client = {
  id: string;
  full_name: string;
  assigned: boolean;
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

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "pre_workout", label: "Pre-Workout" },
  { value: "post_workout", label: "Post-Workout" },
];

const MEAL_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  breakfast: { color: "#F59E0B", bg: "#FEF3C7" },
  lunch: { color: "#10B981", bg: "#D1FAE5" },
  dinner: { color: "#1B68B4", bg: "#EFF6FF" },
  snack: { color: "#8B5CF6", bg: "#EDE9FE" },
  pre_workout: { color: "#2DC4B8", bg: "#CCFBF1" },
  post_workout: { color: "#2DC4B8", bg: "#CCFBF1" },
};

const smallLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#6B7A8D",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid #E2EAF0",
  background: "#F4F7FA",
  fontSize: 14,
  color: "#0D1827",
  outline: "none",
  boxSizing: "border-box",
};

export default function MealPlanEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: planId } = use(params);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMeal, setAddingMeal] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New meal form state
  const [nmMode, setNmMode] = useState<"search" | "manual">("search");
  const [nmName, setNmName] = useState("");
  const [nmType, setNmType] = useState("lunch");
  const [nmCals, setNmCals] = useState("");
  const [nmProtein, setNmProtein] = useState("");
  const [nmCarbs, setNmCarbs] = useState("");
  const [nmFat, setNmFat] = useState("");
  const [nmDesc, setNmDesc] = useState("");
  const [nmIngredients, setNmIngredients] = useState("");
  const [nmInstructions, setNmInstructions] = useState("");

  // Food database search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [portionAmt, setPortionAmt] = useState("100");
  const [portionUnit, setPortionUnit] = useState<"g" | "oz">("g");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: planData },
        { data: mealsData },
        { data: clientsData },
        { data: assignmentsData },
      ] = await Promise.all([
        supabase
          .from("meal_plans")
          .select("id, name, calories_target, protein_target, carbs_target, fat_target")
          .eq("id", planId)
          .single(),
        supabase
          .from("meals")
          .select(
            "id, name, meal_type, description, calories, protein_g, carbs_g, fat_g, ingredients, instructions, sort_order"
          )
          .eq("plan_id", planId)
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("trainer_id", user.id),
        supabase
          .from("client_meal_plans")
          .select("client_id")
          .eq("plan_id", planId)
          .eq("is_active", true),
      ]);

      setPlan(planData as Plan);
      setMeals((mealsData ?? []) as Meal[]);

      const assignedIds = new Set((assignmentsData ?? []).map((a: any) => a.client_id));
      setClients(
        (clientsData ?? []).map((c: any) => ({
          id: c.id,
          full_name: c.full_name,
          assigned: assignedIds.has(c.id),
        }))
      );
      setLoading(false);
    })();
  }, [planId]);

  function handleSearchInput(q: string) {
    setSearchQuery(q);
    setSelectedFood(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => doFoodSearch(q), 500);
  }

  async function doFoodSearch(q: string) {
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
    } catch { setSearchResults([]); }
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
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  async function handleBarcodeImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!("BarcodeDetector" in window)) {
      alert("Barcode scanning isn't supported on this browser. Try typing the food name instead.");
      return;
    }
    const img = await createImageBitmap(file);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    const barcodes = await detector.detect(img);
    if (barcodes.length > 0) {
      await lookupBarcode(barcodes[0].rawValue);
    } else {
      alert("No barcode found. Try again with better lighting.");
    }
    e.target.value = "";
  }

  function applyPortion(food: FoodResult, amt: string, unit: "g" | "oz") {
    const grams = unit === "oz" ? parseFloat(amt) * 28.3495 : parseFloat(amt);
    if (!grams || isNaN(grams)) { setNmCals(""); setNmProtein(""); setNmCarbs(""); setNmFat(""); return; }
    const f = grams / 100;
    setNmCals(food.calories_100g != null ? String(Math.round(food.calories_100g * f)) : "");
    setNmProtein(food.protein_100g != null ? String(Math.round(food.protein_100g * f)) : "");
    setNmCarbs(food.carbs_100g != null ? String(Math.round(food.carbs_100g * f)) : "");
    setNmFat(food.fat_100g != null ? String(Math.round(food.fat_100g * f)) : "");
  }

  function selectFood(food: FoodResult) {
    setSelectedFood(food);
    setSearchQuery(food.name);
    setSearchResults([]);
    applyPortion(food, portionAmt, portionUnit);
  }

  function handlePortionChange(amt: string, unit: "g" | "oz") {
    setPortionAmt(amt);
    setPortionUnit(unit);
    if (selectedFood) applyPortion(selectedFood, amt, unit);
  }

  function resetMealForm() {
    setNmName("");
    setNmType("lunch");
    setNmCals("");
    setNmProtein("");
    setNmCarbs("");
    setNmFat("");
    setNmDesc("");
    setNmIngredients("");
    setNmInstructions("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedFood(null);
    setPortionAmt("100");
    setPortionUnit("g");
  }

  async function addMeal() {
    const mealName = nmMode === "search" ? (selectedFood?.name ?? searchQuery).trim() : nmName.trim();
    if (!mealName) return;
    setSaving(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("meals")
      .insert({
        plan_id: planId,
        name: mealName,
        meal_type: nmType,
        description: nmDesc.trim() || null,
        calories: parseInt(nmCals) || null,
        protein_g: parseInt(nmProtein) || null,
        carbs_g: parseInt(nmCarbs) || null,
        fat_g: parseInt(nmFat) || null,
        ingredients: nmIngredients.trim() || null,
        instructions: nmInstructions.trim() || null,
        sort_order: meals.length,
      })
      .select()
      .single();

    if (!error && data) {
      setMeals((prev) => [...prev, data as Meal]);
    }
    resetMealForm();
    setSaving(false);
    setAddingMeal(false);
  }

  async function deleteMeal(id: string) {
    if (!window.confirm("Remove this meal?")) return;
    const supabase = createClient();
    await supabase.from("meals").delete().eq("id", id);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }

  async function toggleAssignment(clientId: string, isAssigned: boolean) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (isAssigned) {
      await supabase
        .from("client_meal_plans")
        .update({ is_active: false })
        .eq("client_id", clientId)
        .eq("plan_id", planId);
    } else {
      await supabase.from("client_meal_plans").upsert({
        client_id: clientId,
        plan_id: planId,
        trainer_id: user.id,
        is_active: true,
      });
    }

    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, assigned: !isAssigned } : c
      )
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#F4F7FA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B7A8D",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6B7A8D" }}>
        Meal plan not found
      </div>
    );
  }

  const hasTargets =
    plan.calories_target ||
    plan.protein_target ||
    plan.carbs_target ||
    plan.fat_target;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
      {/* Header */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #E2EAF0",
          padding: "20px 20px 16px",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link
            href="/trainer/nutrition"
            style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}
          >
            ← Meal Plans
          </Link>
          <div
            style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}
          >
            {plan.name}
          </div>

          {hasTargets && (
            <div
              style={{
                marginTop: 10,
                display: "inline-flex",
                flexWrap: "wrap",
                gap: 6,
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 10,
                padding: "7px 12px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1B68B4" }}>
                Daily Targets:
              </span>
              {plan.calories_target && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1B68B4" }}>
                  {plan.calories_target} kcal
                </span>
              )}
              {plan.protein_target && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1B68B4" }}>
                  · {plan.protein_target}g P
                </span>
              )}
              {plan.carbs_target && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1B68B4" }}>
                  · {plan.carbs_target}g C
                </span>
              )}
              {plan.fat_target && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1B68B4" }}>
                  · {plan.fat_target}g F
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Meals Section */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1827" }}>
              Meals
            </div>
            {!addingMeal && (
              <button
                onClick={() => setAddingMeal(true)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 9,
                  background: "#2DC4B8",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                + Add Meal
              </button>
            )}
          </div>

          {/* Add meal form */}
          {addingMeal && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "18px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1827" }}>Add Meal</div>

              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 0, background: "#F4F7FA", borderRadius: 10, padding: 3 }}>
                {(["search", "manual"] as const).map(m => (
                  <button key={m} onClick={() => { setNmMode(m); resetMealForm(); }}
                    style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: nmMode === m ? "#fff" : "transparent", color: nmMode === m ? "#0D1827" : "#6B7A8D", fontWeight: nmMode === m ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: nmMode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                    {m === "search" ? "🔍 Search Database" : "✏️ Enter Manually"}
                  </button>
                ))}
              </div>

              {nmMode === "search" ? (
                <>
                  <div>
                    <label style={smallLabel}>Food Name or Brand</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={searchQuery} onChange={e => handleSearchInput(e.target.value)}
                        placeholder="e.g. chicken breast, brown rice…" style={{ ...fieldInput, flex: 1 }} autoComplete="off" />
                      <button type="button" onClick={() => barcodeInputRef.current?.click()} title="Scan barcode"
                        style={{ flexShrink: 0, padding: "0 12px", borderRadius: 8, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 18, cursor: "pointer" }}>
                        📷
                      </button>
                      <input ref={barcodeInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleBarcodeImage} />
                    </div>
                  </div>

                  {searching && <div style={{ fontSize: 13, color: "#6B7A8D", textAlign: "center" }}>Searching…</div>}

                  {searchResults.length > 0 && !selectedFood && (
                    <div style={{ border: "1px solid #E2EAF0", borderRadius: 10, overflow: "hidden", maxHeight: 240, overflowY: "auto" }}>
                      {searchResults.map((food, i) => (
                        <button key={food.id} onClick={() => selectFood(food)}
                          style={{ width: "100%", display: "flex", flexDirection: "column", padding: "10px 14px", background: "#fff", border: "none", borderBottom: i < searchResults.length - 1 ? "1px solid #F4F7FA" : "none", cursor: "pointer", textAlign: "left" }}>
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

                  {selectedFood && (
                    <div style={{ background: "#F0FDF9", border: "1.5px solid #2DC4B8", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{selectedFood.name}</div>
                          {selectedFood.brand && <div style={{ fontSize: 12, color: "#6B7A8D" }}>{selectedFood.brand}</div>}
                        </div>
                        <button onClick={() => { setSelectedFood(null); setSearchQuery(""); setSearchResults([]); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9CA3AF" }}>✕</button>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label style={smallLabel}>Portion Size</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="number" min="1" value={portionAmt} onChange={e => handlePortionChange(e.target.value, portionUnit)} style={{ ...fieldInput, flex: 1 }} />
                          <button onClick={() => handlePortionChange(portionAmt, portionUnit === "g" ? "oz" : "g")}
                            style={{ flexShrink: 0, padding: "0 16px", borderRadius: 8, border: "2px solid #2DC4B8", background: "#fff", color: "#2DC4B8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                            {portionUnit}
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 6 }}>
                          Quick:{" "}
                          {[["1oz","1","oz"],["3oz","3","oz"],["4oz","4","oz"],["6oz","6","oz"],["100g","100","g"],["200g","200","g"]].map(([label,amt,unit]) => (
                            <button key={label} onClick={() => handlePortionChange(amt, unit as "g"|"oz")}
                              style={{ marginRight: 5, marginBottom: 4, fontSize: 11, padding: "2px 8px", borderRadius: 20, border: "1px solid #E2EAF0", background: "#fff", color: "#1B68B4", cursor: "pointer", fontWeight: 600 }}>
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
                  <label style={smallLabel}>Meal Name *</label>
                  <input type="text" value={nmName} onChange={e => setNmName(e.target.value)}
                    placeholder="e.g. Grilled Chicken & Rice" style={fieldInput} autoFocus />
                </div>
              )}

              {/* Meal type chips */}
              <div>
                <label style={smallLabel}>Meal Type</label>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {MEAL_TYPES.map((mt) => {
                    const sel = nmType === mt.value;
                    const c = MEAL_TYPE_COLORS[mt.value];
                    return (
                      <button key={mt.value} onClick={() => setNmType(mt.value)}
                        style={{ padding: "7px 13px", borderRadius: 8, border: sel ? "none" : "1px solid #E2EAF0", background: sel ? c.bg : "#F4F7FA", color: sel ? c.color : "#6B7A8D", fontWeight: sel ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {mt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Macros 2x2 grid */}
              <div>
                <label style={smallLabel}>
                  Macros {nmMode === "search" && selectedFood ? <span style={{ fontWeight: 400, color: "#2DC4B8", textTransform: "none" }}>(auto-calculated)</span> : null}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Calories", val: nmCals, set: setNmCals, ph: "450", color: "#F59E0B" },
                    { label: "Protein (g)", val: nmProtein, set: setNmProtein, ph: "40", color: "#1B68B4" },
                    { label: "Carbs (g)", val: nmCarbs, set: setNmCarbs, ph: "50", color: "#10B981" },
                    { label: "Fat (g)", val: nmFat, set: setNmFat, ph: "12", color: "#EF4444" },
                  ].map(({ label, val, set, ph, color }) => (
                    <div key={label}>
                      <label style={{ ...smallLabel, color }}>{label}</label>
                      <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                        style={{ ...fieldInput, borderColor: val ? color + "88" : "#E2EAF0" }} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={smallLabel}>Description (optional)</label>
                <textarea value={nmDesc} onChange={e => setNmDesc(e.target.value)} placeholder="Brief notes about this meal..."
                  rows={2} style={{ ...fieldInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }} />
              </div>

              <div>
                <label style={smallLabel}>Ingredients (optional)</label>
                <textarea value={nmIngredients} onChange={e => setNmIngredients(e.target.value)}
                  placeholder="200g chicken breast, 1 cup brown rice..." rows={3}
                  style={{ ...fieldInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }} />
              </div>

              <div>
                <label style={smallLabel}>Instructions (optional)</label>
                <textarea value={nmInstructions} onChange={e => setNmInstructions(e.target.value)}
                  placeholder="Grill chicken, steam rice, combine..." rows={3}
                  style={{ ...fieldInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }} />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { resetMealForm(); setAddingMeal(false); }}
                  style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={addMeal}
                  disabled={saving || !(nmMode === "search" ? (selectedFood?.name ?? searchQuery).trim() : nmName.trim())}
                  style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                    opacity: saving || !(nmMode === "search" ? (selectedFood?.name ?? searchQuery).trim() : nmName.trim()) ? 0.6 : 1 }}>
                  {saving ? "Saving..." : "Save Meal"}
                </button>
              </div>
            </div>
          )}

          {/* Meals list */}
          {meals.length === 0 && !addingMeal && (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #E2EAF0",
                padding: "40px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
              <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>
                No meals yet
              </div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>
                Add meals to build out this nutrition plan
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {meals.map((meal) => {
              const isExpanded = expandedMeal === meal.id;
              const typeColors = MEAL_TYPE_COLORS[meal.meal_type] ?? {
                color: "#6B7A8D",
                bg: "#F4F7FA",
              };
              const typeLabel =
                MEAL_TYPES.find((t) => t.value === meal.meal_type)?.label ??
                meal.meal_type;

              const macroParts: string[] = [];
              if (meal.calories) macroParts.push(`${meal.calories} kcal`);
              if (meal.protein_g) macroParts.push(`${meal.protein_g}g P`);
              if (meal.carbs_g) macroParts.push(`${meal.carbs_g}g C`);
              if (meal.fat_g) macroParts.push(`${meal.fat_g}g F`);

              return (
                <div
                  key={meal.id}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: `1px solid ${isExpanded ? "#1B68B4" : "#E2EAF0"}`,
                    overflow: "hidden",
                    transition: "border-color 0.15s",
                  }}
                >
                  {/* Meal row */}
                  <div
                    onClick={() =>
                      setExpandedMeal(isExpanded ? null : meal.id)
                    }
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: typeColors.color,
                        background: typeColors.bg,
                        padding: "3px 8px",
                        borderRadius: 6,
                        flexShrink: 0,
                      }}
                    >
                      {typeLabel}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}
                      >
                        {meal.name}
                      </div>
                      {macroParts.length > 0 && (
                        <div
                          style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}
                        >
                          {macroParts.join(" · ")}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        color: "#9CA3AF",
                        fontSize: 18,
                        transition: "transform 0.15s",
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    >
                      ›
                    </div>
                  </div>

                  {/* Expanded meal details */}
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: "1px solid #EFF6FF",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {meal.description && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>
                            Description
                          </div>
                          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                            {meal.description}
                          </div>
                        </div>
                      )}

                      {meal.ingredients && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>
                            Ingredients
                          </div>
                          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                            {meal.ingredients}
                          </div>
                        </div>
                      )}

                      {meal.instructions && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>
                            Instructions
                          </div>
                          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                            {meal.instructions}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => deleteMeal(meal.id)}
                        style={{
                          alignSelf: "flex-start",
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: "#FEE2E2",
                          color: "#DC2626",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Delete Meal
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Assigned Clients Section */}
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#0D1827",
              marginBottom: 12,
            }}
          >
            Assigned Clients
          </div>

          {clients.length === 0 ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #E2EAF0",
                padding: "32px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>
                No clients yet
              </div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>
                Add clients from the Clients section to assign plans
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #E2EAF0",
                overflow: "hidden",
              }}
            >
              {clients.map((client, idx) => (
                <div
                  key={client.id}
                  onClick={() => toggleAssignment(client.id, client.assigned)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderBottom:
                      idx < clients.length - 1 ? "1px solid #F3F4F6" : "none",
                    cursor: "pointer",
                    background: client.assigned ? "#F0FFF8" : "#fff",
                    transition: "background 0.1s",
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `2px solid ${client.assigned ? "#2DC4B8" : "#D1D5DB"}`,
                      background: client.assigned ? "#2DC4B8" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "background 0.1s, border-color 0.1s",
                    }}
                  >
                    {client.assigned && (
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, lineHeight: 1 }}>
                        ✓
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0D1827" }}>
                      {client.full_name}
                    </div>
                  </div>

                  {client.assigned && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#2DC4B8",
                        background: "#CCFBF1",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      Assigned
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
