"use client";
import { useState } from "react";

type Meal = {
  name: string;
  description: string;
  minutes: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  uses: string[];
  steps: string[];
};

const SUGGESTIONS = ["Eggs", "Chicken", "Rice", "Salmon", "Oats", "Greek yogurt", "Broccoli", "Sweet potato", "Avocado", "Beef", "Pasta", "Spinach"];

export function KitchenMeals() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openMeal, setOpenMeal] = useState<number | null>(null);

  function add(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (ingredients.some(i => i.toLowerCase() === clean.toLowerCase())) { setInput(""); return; }
    setIngredients(prev => [...prev, clean]);
    setInput("");
  }

  function remove(name: string) {
    setIngredients(prev => prev.filter(i => i !== name));
  }

  async function generate() {
    setLoading(true);
    setError("");
    setMeals([]);
    setOpenMeal(null);
    try {
      const res = await fetch("/api/meals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't generate meals."); return; }
      setMeals(data.meals ?? []);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const unused = SUGGESTIONS.filter(s => !ingredients.some(i => i.toLowerCase() === s.toLowerCase()));

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>🍳 What&apos;s in your kitchen?</div>
      <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 14 }}>
        Add what you have and get meal ideas with macros.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          placeholder="Add ingredient…"
          style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" }}
        />
        <button
          onClick={() => add(input)}
          disabled={!input.trim()}
          style={{ padding: "12px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 18, border: "none", cursor: "pointer", opacity: input.trim() ? 1 : 0.4 }}
        >+</button>
      </div>

      {unused.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {unused.slice(0, 6).map(s => (
            <button
              key={s}
              onClick={() => add(s)}
              style={{ padding: "5px 11px", borderRadius: 8, background: "#F4F7FA", border: "1px solid #E2EAF0", color: "#6B7A8D", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >+ {s}</button>
          ))}
        </div>
      )}

      {ingredients.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {ingredients.map(i => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 11px", borderRadius: 8, background: "#0D1827", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              {i}
              <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}

      <button
        onClick={generate}
        disabled={ingredients.length === 0 || loading}
        style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: ingredients.length === 0 || loading ? 0.5 : 1 }}
      >
        {loading ? "Finding meals…" : `Generate Meal Ideas${ingredients.length ? ` (${ingredients.length} ingredient${ingredients.length !== 1 ? "s" : ""})` : ""}`}
      </button>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginTop: 12 }}>{error}</div>
      )}

      {meals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {meals.map((m, idx) => (
            <div key={idx} style={{ border: "1px solid #E2EAF0", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => setOpenMeal(openMeal === idx ? null : idx)}
                style={{ width: "100%", textAlign: "left", background: "#F8FAFB", border: "none", padding: "13px 14px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0D1827" }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: "#6B7A8D", whiteSpace: "nowrap" }}>🕐 {m.minutes}m</span>
                </div>
                <div style={{ fontSize: 13, color: "#6B7A8D", lineHeight: 1.5 }}>{m.description}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: "#EF4444" }}>🔥 {m.calories} kcal</span>
                  <span style={{ color: "#1B68B4" }}>P: {m.protein_g}g</span>
                  <span style={{ color: "#F59E0B" }}>C: {m.carbs_g}g</span>
                  <span style={{ color: "#8B5CF6" }}>F: {m.fat_g}g</span>
                </div>
              </button>
              {openMeal === idx && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid #E2EAF0" }}>
                  {m.uses.length > 0 && (
                    <div style={{ fontSize: 12, color: "#6B7A8D", marginBottom: 10 }}>
                      Uses: {m.uses.join(", ")}
                    </div>
                  )}
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#0D1827", lineHeight: 1.7 }}>
                    {m.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              )}
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
            AI-generated ideas — macros are estimates. Check with your trainer for anything specific.
          </div>
        </div>
      )}
    </div>
  );
}
