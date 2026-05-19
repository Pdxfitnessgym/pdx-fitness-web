"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  calories_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  client_count: number;
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

export default function NutritionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCals, setNewCals] = useState("");
  const [newProtein, setNewProtein] = useState("");
  const [newCarbs, setNewCarbs] = useState("");
  const [newFat, setNewFat] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: rawPlans }, { data: assignments }] = await Promise.all([
        supabase
          .from("meal_plans")
          .select(
            "id, name, description, calories_target, protein_target, carbs_target, fat_target"
          )
          .eq("trainer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_meal_plans")
          .select("plan_id")
          .eq("is_active", true),
      ]);

      const countMap: Record<string, number> = {};
      for (const a of assignments ?? []) {
        countMap[a.plan_id] = (countMap[a.plan_id] ?? 0) + 1;
      }

      setPlans(
        (rawPlans ?? []).map((p: any) => ({
          ...p,
          client_count: countMap[p.id] ?? 0,
        }))
      );
      setLoading(false);
    })();
  }, []);

  function resetForm() {
    setNewName("");
    setNewDesc("");
    setNewCals("");
    setNewProtein("");
    setNewCarbs("");
    setNewFat("");
  }

  async function createPlan() {
    if (!newName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase
      .from("meal_plans")
      .insert({
        trainer_id: user.id,
        name: newName.trim(),
        description: newDesc.trim() || null,
        calories_target: parseInt(newCals) || null,
        protein_target: parseInt(newProtein) || null,
        carbs_target: parseInt(newCarbs) || null,
        fat_target: parseInt(newFat) || null,
      })
      .select()
      .single();

    if (!error && data) {
      setPlans((prev) => [{ ...data, client_count: 0 }, ...prev]);
    }
    resetForm();
    setSaving(false);
    setCreating(false);
  }

  async function deletePlan(id: string) {
    if (!window.confirm("Delete this meal plan? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("meal_plans").delete().eq("id", id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
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
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <Link
              href="/trainer"
              style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}
            >
              ← Dashboard
            </Link>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#1B68B4",
                marginTop: 4,
              }}
            >
              Meal Plans
            </div>
            <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
              Build nutrition plans for your clients
            </div>
          </div>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "#2DC4B8",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              + New Plan
            </button>
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
          gap: 14,
        }}
      >
        {/* Create form */}
        {creating && (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #E2EAF0",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{ fontSize: 16, fontWeight: 800, color: "#0D1827", marginBottom: 2 }}
            >
              New Meal Plan
            </div>

            <div>
              <label style={smallLabel}>Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. High Protein Cut"
                style={fieldInput}
                autoFocus
              />
            </div>

            <div>
              <label style={smallLabel}>Description (optional)</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description of this plan..."
                rows={2}
                style={{
                  ...fieldInput,
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.4,
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A8D", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>
                Daily Targets (optional)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={smallLabel}>Calories</label>
                  <input
                    type="number"
                    value={newCals}
                    onChange={(e) => setNewCals(e.target.value)}
                    placeholder="2000"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={smallLabel}>Protein (g)</label>
                  <input
                    type="number"
                    value={newProtein}
                    onChange={(e) => setNewProtein(e.target.value)}
                    placeholder="150"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={smallLabel}>Carbs (g)</label>
                  <input
                    type="number"
                    value={newCarbs}
                    onChange={(e) => setNewCarbs(e.target.value)}
                    placeholder="200"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={smallLabel}>Fat (g)</label>
                  <input
                    type="number"
                    value={newFat}
                    onChange={(e) => setNewFat(e.target.value)}
                    placeholder="65"
                    style={fieldInput}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => {
                  resetForm();
                  setCreating(false);
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
                onClick={createPlan}
                disabled={saving || !newName.trim()}
                style={{
                  flex: 2,
                  padding: "11px",
                  borderRadius: 10,
                  border: "none",
                  background: "#1B68B4",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: saving || !newName.trim() ? "not-allowed" : "pointer",
                  opacity: saving || !newName.trim() ? 0.6 : 1,
                }}
              >
                {saving ? "Creating..." : "Create Plan"}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {plans.length === 0 && !creating && (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #E2EAF0",
              padding: "52px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 12 }}>🥗</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0D1827", marginBottom: 4 }}>
              No meal plans yet
            </div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>
              Create nutrition plans and assign them to clients
            </div>
          </div>
        )}

        {/* Plans list */}
        {plans.map((plan) => {
          const macroChips: string[] = [];
          if (plan.calories_target) macroChips.push(`${plan.calories_target} kcal`);
          if (plan.protein_target) macroChips.push(`${plan.protein_target}g protein`);
          if (plan.carbs_target) macroChips.push(`${plan.carbs_target}g carbs`);
          if (plan.fat_target) macroChips.push(`${plan.fat_target}g fat`);

          return (
            <div
              key={plan.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #E2EAF0",
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 800, color: "#0D1827" }}
                  >
                    {plan.name}
                  </div>
                  {plan.description && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6B7A8D",
                        marginTop: 3,
                        lineHeight: 1.4,
                      }}
                    >
                      {plan.description}
                    </div>
                  )}

                  {macroChips.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {macroChips.map((chip, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#1B68B4",
                            background: "#EFF6FF",
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#2DC4B8",
                    background: "#CCFBF1",
                    padding: "4px 9px",
                    borderRadius: 8,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {plan.client_count} client{plan.client_count !== 1 ? "s" : ""}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <Link
                  href={`/trainer/nutrition/${plan.id}`}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: 9,
                    background: "#EFF6FF",
                    color: "#1B68B4",
                    fontWeight: 700,
                    fontSize: 13,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  Edit →
                </Link>
                <button
                  onClick={() => deletePlan(plan.id)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 9,
                    border: "none",
                    background: "#FEE2E2",
                    color: "#DC2626",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
