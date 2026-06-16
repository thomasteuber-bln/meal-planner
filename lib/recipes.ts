import {
  fetchSpoonacularRecipeById,
  fetchSpoonacularRecipes,
  getCachedRecipe,
  storeCachedRecipe,
} from "./spoonacular";
import {
  getGermanCachedRecipe,
  hasGermanLocalization,
  localizeRecipesDe,
} from "./translateRecipe";

export type Lang = "en" | "de";

export interface Localized {
  en: string;
  de: string;
}

export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "nut-free";

export type NutritionTag =
  | "high-protein"
  | "high-fiber"
  | "low-carb"
  | "low-calorie"
  | "low-fat";

export type MealType = "breakfast" | "lunch" | "dinner";

/** Relative cost tier; "low" is cheapest. */
export type CostTier = "low" | "medium" | "high";

export interface Recipe {
  id: string;
  title: Localized;
  description: Localized;
  minutes: number;
  servings: number;
  meals: MealType[];
  tags: DietaryTag[];
  nutrition: NutritionTag[];
  cost: CostTier;
  /** Display ingredient lines, with European (metric) measures, per language. */
  ingredients: Localized[];
  /** Step-by-step preparation instructions, per language. */
  steps: Localized[];
  /** Lowercase keywords (both languages) used for search/filtering. */
  searchTerms: string[];
}

const COST_ORDER: Record<CostTier, number> = { low: 1, medium: 2, high: 3 };

export interface SearchRecipesArgs {
  query?: string;
  dietaryFilters?: DietaryTag[];
  mealType?: MealType;
  maxPrepTime?: number;
  nutrition?: NutritionTag[];
  budget?: CostTier;
  /** Ingredients the user already has — used to rank by overlap, not to hard-filter. */
  availableIngredients?: string[];
  /** Ingredients to avoid entirely. */
  excludeIngredients?: string[];
  maxResults?: number;
}

function haystack(recipe: Recipe): string {
  return [
    recipe.title.en,
    recipe.title.de,
    recipe.description.en,
    recipe.description.de,
    ...recipe.searchTerms,
    ...recipe.ingredients.flatMap((i) => [i.en, i.de]),
  ]
    .join(" ")
    .toLowerCase();
}

function matchesTerm(recipe: Recipe, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return haystack(recipe).includes(t);
}

export function ingredientLineMatchesTerm(line: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return line.toLowerCase().includes(t);
}

/** How many recipe ingredient lines match at least one available ingredient. */
export function countIngredientOverlap(
  recipe: Recipe,
  availableIngredients: string[],
): number {
  if (!availableIngredients.length) return 0;
  return recipe.ingredients.filter((ing) =>
    availableIngredients.some(
      (a) =>
        ingredientLineMatchesTerm(ing.en, a) ||
        ingredientLineMatchesTerm(ing.de, a),
    ),
  ).length;
}

function rankRecipes(pool: Recipe[], args: SearchRecipesArgs): Recipe[] {
  const {
    query = "",
    dietaryFilters = [],
    mealType,
    maxPrepTime,
    nutrition = [],
    budget,
    availableIngredients = [],
    excludeIngredients = [],
    maxResults = 5,
  } = args;

  if (pool.length === 0) return [];

  // Diet is enforced by Spoonacular query params; don't re-filter on inferred tags
  // (many API recipes omit vegetarian/vegan flags and would be dropped incorrectly).
  const candidates = pool.filter(
    (r) => !excludeIngredients.some((bad) => matchesTerm(r, bad)),
  );

  const satisfiesSoft = (r: Recipe) => {
    if (mealType && !r.meals.includes(mealType)) return false;
    if (typeof maxPrepTime === "number" && r.minutes > maxPrepTime) return false;
    if (nutrition.length && !nutrition.every((n) => r.nutrition.includes(n)))
      return false;
    if (budget && COST_ORDER[r.cost] > COST_ORDER[budget]) return false;
    return true;
  };

  const strict = candidates.filter(satisfiesSoft);
  const poolForRank = strict.length >= 3 ? strict : candidates;
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);

  const score = (r: Recipe) => {
    let s = 0;
    if (satisfiesSoft(r)) s += 10;
    if (mealType && r.meals.includes(mealType)) s += 3;
    s += dietaryFilters.filter((d) => r.tags.includes(d)).length * 2;
    s += queryWords.filter((w) => matchesTerm(r, w)).length * 2;
    s += nutrition.filter((n) => r.nutrition.includes(n)).length;
    if (typeof maxPrepTime === "number" && r.minutes <= maxPrepTime) s += 1;
    return s;
  };

  const ranked = [...poolForRank].sort((a, b) => {
    if (availableIngredients.length > 0) {
      const overlapA = countIngredientOverlap(a, availableIngredients);
      const overlapB = countIngredientOverlap(b, availableIngredients);
      if (overlapB !== overlapA) return overlapB - overlapA;
      const ratioA = overlapA / Math.max(a.ingredients.length, 1);
      const ratioB = overlapB / Math.max(b.ingredients.length, 1);
      if (ratioB !== ratioA) return ratioB - ratioA;
    }
    return score(b) - score(a) || a.minutes - b.minutes;
  });

  const clamped = Math.min(Math.max(maxResults, 3), 5);
  const results = ranked.slice(0, clamped);
  return results.length > 0 ? results : candidates.slice(0, clamped);
}

export async function getRecipeById(id: string): Promise<Recipe | undefined> {
  const germanCached = getGermanCachedRecipe(id);
  if (germanCached) {
    storeCachedRecipe(germanCached);
    return germanCached;
  }

  const cached = getCachedRecipe(id);
  if (cached && hasGermanLocalization(cached)) return cached;

  const recipe = cached ?? (await fetchSpoonacularRecipeById(id));
  if (!recipe) return undefined;

  const [localized] = await localizeRecipesDe([recipe]);
  storeCachedRecipe(localized);
  return localized;
}

export async function searchRecipes(args: SearchRecipesArgs): Promise<Recipe[]> {
  const results = await fetchSpoonacularRecipes(args);
  console.log(`[search] spoonacular returned ${results.length} recipe(s)`);
  const localized = await localizeRecipesDe(results);
  const ranked = rankRecipes(localized, args);
  console.log(`[search] returning ${ranked.length} recipe(s) after rank`);
  for (const recipe of ranked) storeCachedRecipe(recipe);
  return ranked;
}
