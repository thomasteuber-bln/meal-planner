import { NextResponse } from "next/server";
import { getRecipeById } from "@/lib/recipes";
import {
  RecipeApiConfigError,
  RecipeApiError,
} from "@/lib/spoonacular";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const recipe = await getRecipeById(id);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    return NextResponse.json({ recipe });
  } catch (error) {
    const message =
      error instanceof RecipeApiConfigError || error instanceof RecipeApiError
        ? error.message
        : "Failed to load recipe.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
