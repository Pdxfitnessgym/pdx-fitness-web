import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MealsSchema = z.object({
  meals: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      minutes: z.number(),
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      uses: z.array(z.string()),
      steps: z.array(z.string()),
    })
  ),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Meal ideas aren't set up yet — ask your trainer." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const ingredients: string[] = Array.isArray(body?.ingredients)
    ? body.ingredients.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30)
    : [];
  const goal: string = typeof body?.goal === "string" ? body.goal.slice(0, 200) : "";

  if (ingredients.length === 0) {
    return NextResponse.json({ error: "Add at least one ingredient." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(MealsSchema),
      },
      system:
        "You are a sports nutrition assistant for a personal training app. " +
        "Given the ingredients someone actually has, suggest realistic meals they can cook now. " +
        "Assume basic staples (salt, pepper, oil, common spices, water) are on hand, but do not " +
        "assume any other ingredient that wasn't listed. Prefer whole-food, high-protein meals. " +
        "Macros are estimates for one serving. Keep steps short and practical.",
      messages: [
        {
          role: "user",
          content:
            `Ingredients on hand: ${ingredients.join(", ")}.` +
            (goal ? `\nTheir goal: ${goal}.` : "") +
            `\n\nSuggest 3 meals. In "uses", list only ingredients from the list above.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't generate meals for that. Try different ingredients." },
        { status: 422 }
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: "Couldn't read the meal ideas. Try again." }, { status: 502 });
    }

    return NextResponse.json({ meals: parsed.meals });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Busy right now — try again in a moment." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      // Don't leak provider details to the client
      console.error("meal generation failed", err.status, err.message);
      return NextResponse.json({ error: "Couldn't generate meals. Try again." }, { status: 502 });
    }
    console.error("meal generation failed", err);
    return NextResponse.json({ error: "Couldn't generate meals. Try again." }, { status: 500 });
  }
}
