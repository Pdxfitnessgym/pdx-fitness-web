"use client";
import { useState, useEffect, use } from "react";
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
  const [nmName, setNmName] = useState("");
  const [nmType, setNmType] = useState("lunch");
  const [nmCals, setNmCals] = useState("");
  const [nmProtein, setNmProtein] = useState("");
  const [nmCarbs, setNmCarbs] = useState("");
  const [nmFat, setNmFat] = useState("");
  const [nmDesc, setNmDesc] = useState("");
  const [nmIngredients, setNmIngredients] = useState("");
  const [nmInstructions, setNmInstructions] = useState("");

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
  }

  async function addMeal() {
    if (!nmName.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("meals")
      .insert({
        plan_id: planId,
        name: nmName.trim(),
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
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #E2EAF0",
                padding: "18px",
                marginBottom: 12,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1827" }}>
                Add Meal
              </div>

              <div>
                <label style={smallLabel}>Meal Name *</label>
                <input
                  type="text"
                  value={nmName}
                  onChange={(e) => setNmName(e.target.value)}
                  placeholder="e.g. Grilled Chicken & Rice"
                  style={fieldInput}
                  autoFocus
                />
              </div>

              {/* Meal type chips */}
              <div>
                <label style={smallLabel}>Meal Type</label>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {MEAL_TYPES.map((mt) => {
                    const sel = nmType === mt.value;
                    const c = MEAL_TYPE_COLORS[mt.value];
                    return (
                      <button
                        key={mt.value}
                        onClick={() => setNmType(mt.value)}
                        style={{
                          padding: "7px 13px",
                          borderRadius: 8,
                          border: sel ? "none" : "1px solid #E2EAF0",
                          background: sel ? c.bg : "#F4F7FA",
                          color: sel ? c.color : "#6B7A8D",
                          fontWeight: sel ? 700 : 500,
                          fontSize: 12,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {mt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Macros 2x2 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={smallLabel}>Calories</label>
                  <input
                    type="number"
                    value={nmCals}
                    onChange={(e) => setNmCals(e.target.value)}
                    placeholder="450"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={smallLabel}>Protein (g)</label>
                  <input
                    type="number"
                    value={nmProtein}
                    onChange={(e) => setNmProtein(e.target.value)}
                    placeholder="40"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={smallLabel}>Carbs (g)</label>
                  <input
                    type="number"
                    value={nmCarbs}
                    onChange={(e) => setNmCarbs(e.target.value)}
                    placeholder="50"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={smallLabel}>Fat (g)</label>
                  <input
                    type="number"
                    value={nmFat}
                    onChange={(e) => setNmFat(e.target.value)}
                    placeholder="12"
                    style={fieldInput}
                  />
                </div>
              </div>

              <div>
                <label style={smallLabel}>Description (optional)</label>
                <textarea
                  value={nmDesc}
                  onChange={(e) => setNmDesc(e.target.value)}
                  placeholder="Brief notes about this meal..."
                  rows={2}
                  style={{ ...fieldInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
                />
              </div>

              <div>
                <label style={smallLabel}>Ingredients (optional)</label>
                <textarea
                  value={nmIngredients}
                  onChange={(e) => setNmIngredients(e.target.value)}
                  placeholder="200g chicken breast, 1 cup brown rice..."
                  rows={3}
                  style={{ ...fieldInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
                />
              </div>

              <div>
                <label style={smallLabel}>Instructions (optional)</label>
                <textarea
                  value={nmInstructions}
                  onChange={(e) => setNmInstructions(e.target.value)}
                  placeholder="Grill chicken, steam rice, combine..."
                  rows={3}
                  style={{ ...fieldInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    resetMealForm();
                    setAddingMeal(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: 10,
                    border: "1px solid #E2EAF0",
                    background: "#F4F7FA",
                    color: "#6B7A8D",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addMeal}
                  disabled={saving || !nmName.trim()}
                  style={{
                    flex: 2,
                    padding: "11px",
                    borderRadius: 10,
                    border: "none",
                    background: "#1B68B4",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: saving || !nmName.trim() ? "not-allowed" : "pointer",
                    opacity: saving || !nmName.trim() ? 0.6 : 1,
                  }}
                >
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
