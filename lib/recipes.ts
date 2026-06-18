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
  /** Spoonacular CDN image URL when the API provides one. */
  imageUrl?: string | null;
  /** Spoonacular quality/popularity score (0–100) when available. */
  spoonacularScore?: number | null;
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
  /** Spoonacular dish type labels (e.g. "main course", "dessert"). */
  dishTypes: string[];
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

/** Dessert/snack/beverage — not suitable for lunch or dinner mains. */
const SWEET_DISH_KEYWORDS = [
  "dessert",
  "sweet",
  "candy",
  "ice cream",
  "frozen dessert",
  "beverage",
  "drink",
  "cocktail",
  "smoothie",
  "shake",
];

const SAVORY_DISH_KEYWORDS = [
  "main course",
  "main dish",
  "dinner",
  "lunch",
  "side dish",
  "salad",
  "soup",
  "antipasti",
  "antipasto",
  "brunch",
  "entree",
  "entrée",
];

const DESSERT_TITLE_RE =
  /\b(ice cream|cookies?|brownies?|cupcakes?|cheesecake|key lime pie|lime pie|lemon pie|apple pie|cherry pie|pumpkin pie|chocolate cake|layer cake|fudge|candy|sorbet|gelato|macarons?|doughnuts?|donuts?|meringue)\b/i;

const LIGHT_MEAL_TITLE_RE =
  /\b(yogurt|yoghurt|parfait|smoothie bowl|granola bowl|overnight oats|coleslaw)\b/i;

const BREAKFAST_STYLE_TITLE_RE =
  /\b(yogurt|yoghurt|parfait|smoothie bowl|overnight oats|granola|oatmeal|porridge|cereal)\b/i;

export function isLightMeal(recipe: Recipe): boolean {
  const types = recipe.dishTypes.map((t) => t.toLowerCase());
  const title = recipe.title.en.toLowerCase();

  if (types.some((t) => t === "side dish" || t.includes("salad"))) {
    return true;
  }

  if (/\b(salad|coleslaw|slaw)\b/.test(title)) {
    const isMain = types.some(
      (t) => t.includes("main course") || t.includes("main dish"),
    );
    if (!isMain) return true;
  }

  return LIGHT_MEAL_TITLE_RE.test(recipe.title.en);
}

function isBreakfastStyle(recipe: Recipe): boolean {
  const types = recipe.dishTypes.map((t) => t.toLowerCase());
  if (types.some((t) => t.includes("breakfast"))) return true;
  return BREAKFAST_STYLE_TITLE_RE.test(recipe.title.en);
}

/** Higher = more suitable as a filling lunch/dinner main. */
export function mealHeftTier(recipe: Recipe, mealType: MealType): number {
  const types = recipe.dishTypes.map((t) => t.toLowerCase());
  const isMain = types.some(
    (t) => t.includes("main course") || t.includes("main dish"),
  );
  const isSoup = types.some((t) => t.includes("soup"));
  const isSalad = types.some((t) => t.includes("salad"));

  if (isLightMeal(recipe)) return 0;
  if (isMain) return 3;
  if (isSoup) return 2;
  if (isSalad) return mealType === "lunch" ? 1 : 0;
  return 1;
}

export function isSweetRecipe(recipe: Recipe): boolean {
  const types = recipe.dishTypes.map((t) => t.toLowerCase());

  if (types.some((t) => t.includes("breakfast"))) return false;

  if (types.some((t) => SWEET_DISH_KEYWORDS.some((k) => t.includes(k)))) {
    return true;
  }

  if (types.some((t) => t === "snack" || t === "fingerfood")) {
    return true;
  }

  if (types.some((t) => SAVORY_DISH_KEYWORDS.some((k) => t.includes(k)))) {
    return false;
  }

  return DESSERT_TITLE_RE.test(recipe.title.en);
}

export function recipeMatchesMeal(recipe: Recipe, mealType: MealType): boolean {
  if (isSweetRecipe(recipe)) {
    return (
      mealType === "breakfast" &&
      recipe.dishTypes.some((t) => t.toLowerCase().includes("breakfast"))
    );
  }

  if (mealType === "dinner") {
    if (isLightMeal(recipe) || isBreakfastStyle(recipe)) return false;
  }

  if (mealType === "breakfast") {
    return recipe.meals.includes("breakfast") || isBreakfastStyle(recipe);
  }

  return recipe.meals.includes(mealType);
}

function rankingPool(savoryPool: Recipe[], mealType?: MealType): Recipe[] {
  if (mealType === "dinner") {
    return savoryPool.filter((r) => mealHeftTier(r, "dinner") > 0);
  }
  return savoryPool;
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

  const savoryPool =
    mealType === "lunch" || mealType === "dinner"
      ? candidates.filter((r) => !isSweetRecipe(r))
      : mealType === "breakfast"
        ? candidates.filter(
            (r) =>
              !isSweetRecipe(r) ||
              r.dishTypes.some((t) => t.toLowerCase().includes("breakfast")),
          )
        : candidates;

  const eligiblePool = rankingPool(savoryPool, mealType);

  const meetsMeal = (r: Recipe) =>
    !mealType || recipeMatchesMeal(r, mealType);

  const meetsAllSoft = (r: Recipe) => {
    if (!meetsMeal(r)) return false;
    if (typeof maxPrepTime === "number" && r.minutes > maxPrepTime) return false;
    if (nutrition.length && !nutrition.every((n) => r.nutrition.includes(n)))
      return false;
    if (budget && COST_ORDER[r.cost] > COST_ORDER[budget]) return false;
    return true;
  };

  const strict = eligiblePool.filter(meetsAllSoft);
  const poolForRank = strict.length >= 3 ? strict : eligiblePool.filter(meetsMeal);
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);

  const score = (r: Recipe) => {
    let s = 0;
    if (meetsAllSoft(r)) s += 10;
    if (mealType && recipeMatchesMeal(r, mealType)) s += 3;
    if (mealType === "lunch" || mealType === "dinner") {
      s += mealHeftTier(r, mealType) * 4;
    }
    if (r.dishTypes.some((t) => t.toLowerCase().includes("main course"))) s += 2;
    s += dietaryFilters.filter((d) => r.tags.includes(d)).length * 2;
    s += queryWords.filter((w) => matchesTerm(r, w)).length * 2;
    s += nutrition.filter((n) => r.nutrition.includes(n)).length;
    if (typeof maxPrepTime === "number" && maxPrepTime > 0 && r.minutes <= maxPrepTime)
      s += 2;
    if (budget && COST_ORDER[r.cost] <= COST_ORDER[budget]) s += 2;
    return s;
  };

  const ranked = [...poolForRank].sort((a, b) => {
    if (mealType === "lunch" || mealType === "dinner") {
      const tierDiff = mealHeftTier(b, mealType) - mealHeftTier(a, mealType);
      if (tierDiff !== 0) return tierDiff;
    }
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
  const results: Recipe[] = [];
  const seen = new Set<string>();

  for (const recipe of ranked) {
    if (results.length >= clamped) break;
    if (!meetsMeal(recipe)) continue;
    seen.add(recipe.id);
    results.push(recipe);
  }

  if (results.length < clamped) {
    const extras = [...eligiblePool]
      .filter((r) => meetsMeal(r) && !seen.has(r.id))
      .sort((a, b) => score(b) - score(a));
    for (const recipe of extras) {
      if (results.length >= clamped) break;
      results.push(recipe);
    }
  }

  return results.length > 0 ? results : eligiblePool.slice(0, clamped);
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
