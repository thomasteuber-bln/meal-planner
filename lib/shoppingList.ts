import type { Localized, Recipe } from "./recipes";
import {
  countIngredientOverlap,
  getRecipeById,
  ingredientLineMatchesTerm,
} from "./recipes";
import { scaleIngredientLine, servingScale } from "./scaleIngredients";

export interface ShoppingListResult {
  recipeId: string;
  recipeTitle: Localized;
  availableIngredients: string[];
  missing: Localized[];
  missingCount: number;
  overlapCount: number;
}

function missingIngredientLines(
  recipe: Recipe,
  availableIngredients: string[],
): Localized[] {
  return recipe.ingredients.filter(
    (ing) =>
      !availableIngredients.some(
        (a) =>
          ingredientLineMatchesTerm(ing.en, a) ||
          ingredientLineMatchesTerm(ing.de, a),
      ),
  );
}

export function generateShoppingList(args: {
  recipeId: string;
  availableIngredients: string[];
  householdSize?: number | null;
}): ShoppingListResult | { error: string } {
  const recipe = getRecipeById(args.recipeId);
  if (!recipe) {
    return { error: `Recipe not found: ${args.recipeId}` };
  }

  const available = args.availableIngredients;
  const factor = servingScale(recipe.servings, args.householdSize);
  const missing = missingIngredientLines(recipe, available).map((ing) => ({
    en: scaleIngredientLine(ing.en, factor),
    de: scaleIngredientLine(ing.de, factor),
  }));

  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    availableIngredients: available,
    missing,
    missingCount: missing.length,
    overlapCount: countIngredientOverlap(recipe, available),
  };
}
