import { toEnglishFoodQuery, toEnglishFoodTerms } from "./foodTermsEn";
import {
  enrichRecipesForDisplay,
  fetchSpoonacularRecipeById,
  fetchSpoonacularRecipes,
  getCachedRecipe,
  storeCachedRecipe,
  type PreparedSearchTerms,
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
  /** Ingredients the user already has — fuzzy match; ranked by fewest missing. */
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

const INGREDIENT_STOP_WORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "to",
  "for",
  "with",
  "und",
  "oder",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "mit",
  "zum",
  "zur",
]);

/** Strip measures and numbers so "2 cups chopped tomatoes" → token-friendly text. */
function stripMeasures(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\d.,/]+/g, " ")
    .replace(
      /\b(g|kg|mg|ml|l|cl|dl|oz|lb|lbs|cup|cups|tsp|tbsp|teaspoon|tablespoon|tl|el|piece|pieces|pcs|handful|pinch|bunch|sprig|slice|slices|clove|cloves|can|cans|package|packages|pack|packs|medium|large|small|fresh|dried|chopped|diced|minced|sliced|grated|ground|optional|to taste)\b/gi,
      " ",
    );
}

function ingredientTokens(text: string): string[] {
  return stripMeasures(text)
    .split(/[\s,;()\-/+&]+/)
    .map((t) => t.replace(/[^a-zäöüßà-ÿ]/gi, ""))
    .filter((t) => t.length >= 2 && !INGREDIENT_STOP_WORDS.has(t));
}

function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("oes") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("en") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  if (token.endsWith("n") && token.length > 4) return token.slice(0, -1);
  return token;
}

function tokensMatch(a: string, b: string): boolean {
  const left = singularizeToken(a);
  const right = singularizeToken(b);
  if (left.length < 2 || right.length < 2) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 3 && longer.includes(shorter)) return true;
  return false;
}

/** Fuzzy match: substring, token overlap, or simple plural variants — not exact only. */
export function ingredientLineMatchesTerm(line: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;

  const normalizedLine = stripMeasures(line);
  if (normalizedLine.includes(t)) return true;

  const termTokens = ingredientTokens(t);
  const lineTokens = ingredientTokens(line);
  if (termTokens.length === 0 || lineTokens.length === 0) return false;

  return termTokens.some((tt) =>
    lineTokens.some((lt) => tokensMatch(tt, lt)),
  );
}

function ingredientLineMatchesAnyTerm(
  ing: Localized,
  availableIngredients: string[],
): boolean {
  return availableIngredients.some(
    (a) =>
      ingredientLineMatchesTerm(ing.en, a) ||
      ingredientLineMatchesTerm(ing.de, a),
  );
}

/** How many recipe ingredient lines match at least one available ingredient. */
export function countIngredientOverlap(
  recipe: Recipe,
  availableIngredients: string[],
): number {
  if (!availableIngredients.length) return 0;
  return recipe.ingredients.filter((ing) =>
    ingredientLineMatchesAnyTerm(ing, availableIngredients),
  ).length;
}

/** Recipe ingredient lines with no fuzzy match to anything on hand. */
export function countMissingIngredients(
  recipe: Recipe,
  availableIngredients: string[],
): number {
  if (!availableIngredients.length) return recipe.ingredients.length;
  return recipe.ingredients.filter(
    (ing) => !ingredientLineMatchesAnyTerm(ing, availableIngredients),
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
    if (typeof maxPrepTime === "number" && maxPrepTime > 0 && r.minutes <= maxPrepTime)
      s += 2;
    if (budget && COST_ORDER[r.cost] <= COST_ORDER[budget]) s += 2;
    return s;
  };

  const ranked = [...poolForRank].sort((a, b) => {
    if (availableIngredients.length > 0) {
      const missingA = countMissingIngredients(a, availableIngredients);
      const missingB = countMissingIngredients(b, availableIngredients);
      if (missingA !== missingB) return missingA - missingB;
      const overlapA = countIngredientOverlap(a, availableIngredients);
      const overlapB = countIngredientOverlap(b, availableIngredients);
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
  const cachedStepsLocalized =
    cached &&
    hasGermanLocalization(cached) &&
    cached.steps.some((step) => step.de.trim() !== step.en.trim());

  if (cached && cachedStepsLocalized) return cached;

  const recipe = cached ?? (await fetchSpoonacularRecipeById(id));
  if (!recipe) return undefined;

  const [localized] = await localizeRecipesDe([recipe]);
  storeCachedRecipe(localized);
  return localized;
}

async function prepareSearchTerms(args: SearchRecipesArgs): Promise<{
  terms: PreparedSearchTerms;
  availableForMatch: string[];
}> {
  const available = args.availableIngredients ?? [];
  const exclude = args.excludeIngredients ?? [];
  const query = args.query ?? "";

  const [availableEn, excludeEn, queryEn] = await Promise.all([
    toEnglishFoodTerms(available),
    toEnglishFoodTerms(exclude),
    toEnglishFoodQuery(query),
  ]);

  const availableForMatch = [
    ...new Set([...available, ...availableEn].map((t) => t.trim()).filter(Boolean)),
  ];

  return { terms: { availableEn, excludeEn, queryEn }, availableForMatch };
}

export async function searchRecipes(args: SearchRecipesArgs): Promise<Recipe[]> {
  const { terms, availableForMatch } = await prepareSearchTerms(args);
  const pool = await fetchSpoonacularRecipes(args, terms);
  console.log(`[search] spoonacular returned ${pool.length} recipe(s)`);
  const ranked = rankRecipes(pool, {
    ...args,
    availableIngredients: availableForMatch,
  });
  const enriched = await enrichRecipesForDisplay(ranked);
  const localized = await localizeRecipesDe(enriched, { skipSteps: true });
  console.log(`[search] returning ${localized.length} recipe(s) after rank + enrich + translate`);
  for (const recipe of enriched) storeCachedRecipe(recipe);
  return localized;
}
