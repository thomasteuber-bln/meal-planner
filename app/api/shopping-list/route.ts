import { NextResponse } from "next/server";
import type { Recipe } from "@/lib/recipes";
import { readPreferences } from "@/lib/preferences";
import { generateShoppingList } from "@/lib/shoppingList";

export const maxDuration = 30;

function isRecipePayload(value: unknown): value is Recipe {
  if (!value || typeof value !== "object") return false;
  const r = value as Recipe;
  return (
    typeof r.id === "string" &&
    Array.isArray(r.ingredients) &&
    r.title != null &&
    typeof r.title.en === "string"
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    recipeId?: string;
    availableIngredients?: unknown;
    recipe?: unknown;
  };

  const recipeId = body.recipeId?.trim() ?? "";
  if (!recipeId) {
    return NextResponse.json({ error: "recipeId is required" }, { status: 400 });
  }

  const availableIngredients = Array.isArray(body.availableIngredients)
    ? body.availableIngredients.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  const recipe = isRecipePayload(body.recipe) ? body.recipe : undefined;
  if (recipe && recipe.id !== recipeId) {
    return NextResponse.json({ error: "recipe id mismatch" }, { status: 400 });
  }

  const { preferences } = await readPreferences();
  const result = await generateShoppingList({
    recipeId,
    availableIngredients,
    householdSize: preferences.householdSize,
    recipe,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result);
}
