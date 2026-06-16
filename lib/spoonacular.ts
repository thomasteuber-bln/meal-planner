import type {
  CostTier,
  DietaryTag,
  Localized,
  MealType,
  NutritionTag,
  Recipe,
  SearchRecipesArgs,
} from "./recipes";
import { toEnglishFoodQuery, toEnglishFoodTerms } from "./foodTermsEn";

const BASE_URL = "https://api.spoonacular.com";

export class RecipeApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeApiConfigError";
  }
}

export class RecipeApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeApiError";
  }
}

interface SpoonacularNutrient {
  name: string;
  amount: number;
}

interface SpoonacularExtendedIngredient {
  name: string;
  nameClean?: string;
  original: string;
  measures: {
    metric?: { amount: number; unitShort: string };
  };
}

interface SpoonacularInstructionStep {
  step: string;
}

interface SpoonacularRecipePayload {
  id: number;
  title: string;
  summary?: string;
  readyInMinutes?: number;
  servings?: number;
  dishTypes?: string[];
  diets?: string[];
  vegan?: boolean;
  vegetarian?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  pricePerServing?: number;
  extendedIngredients?: SpoonacularExtendedIngredient[];
  analyzedInstructions?: { steps: SpoonacularInstructionStep[] }[];
  instructions?: string;
  nutrition?: { nutrients: SpoonacularNutrient[] };
}

interface ComplexSearchResponse {
  results: SpoonacularRecipePayload[];
}

const recipeCache = new Map<string, Recipe>();

function getApiKey(): string {
  const key = process.env.SPOONACULAR_API_KEY?.trim();
  if (!key) {
    throw new RecipeApiConfigError(
      "SPOONACULAR_API_KEY is not set. Add it to .env.local (see .env.local.example).",
    );
  }
  return key;
}

const FETCH_TIMEOUT_MS = 12_000;

async function spoonacularGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("apiKey", getApiKey());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new RecipeApiError(
      `Spoonacular request failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }
  return res.json() as Promise<T>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatMetricAmount(amount: number): string {
  if (amount >= 100) return String(Math.round(amount / 10) * 10);
  if (amount >= 25) return String(Math.round(amount / 5) * 5);
  return String(Math.round(amount * 10) / 10);
}

function formatIngredientLine(
  ing: SpoonacularExtendedIngredient,
  lang: "en" | "de",
): string {
  const metric = ing.measures?.metric;
  if (!metric?.amount) {
    return ing.original?.trim() || ing.name;
  }

  const amount = formatMetricAmount(metric.amount);
  const unitRaw = (metric.unitShort ?? "").toLowerCase();
  const name = ing.nameClean || ing.name;

  const unitEn =
    unitRaw === "milliliters" || unitRaw === "milliliter"
      ? "ml"
      : unitRaw === "grams" || unitRaw === "gram"
        ? "g"
        : unitRaw;

  const unitDe =
    unitEn === "tbsp" || unitEn === "tbsps"
      ? "EL"
      : unitEn === "tsp" || unitEn === "tsps"
        ? "TL"
        : unitEn;

  const unit = lang === "de" ? unitDe : unitEn;
  return `${amount} ${unit} ${name}`.trim();
}

function inferMeals(dishTypes: string[] = []): MealType[] {
  const types = dishTypes.map((t) => t.toLowerCase());
  const meals: MealType[] = [];
  if (types.some((t) => t.includes("breakfast"))) meals.push("breakfast");
  if (types.some((t) => t.includes("lunch"))) meals.push("lunch");
  if (types.some((t) => t.includes("dinner") || t.includes("main"))) {
    meals.push("dinner");
  }
  return meals.length ? meals : ["lunch", "dinner"];
}

function inferDietaryTags(data: SpoonacularRecipePayload): DietaryTag[] {
  const tags: DietaryTag[] = [];
  if (data.vegan) tags.push("vegan");
  else if (data.vegetarian) tags.push("vegetarian");
  if (data.glutenFree) tags.push("gluten-free");
  if (data.dairyFree) tags.push("dairy-free");
  return tags;
}

function nutrientAmount(
  nutrients: SpoonacularNutrient[] | undefined,
  name: string,
): number {
  return nutrients?.find((n) => n.name === name)?.amount ?? 0;
}

function inferNutritionTags(data: SpoonacularRecipePayload): NutritionTag[] {
  const nutrients = data.nutrition?.nutrients;
  if (!nutrients?.length) return [];

  const tags: NutritionTag[] = [];
  if (nutrientAmount(nutrients, "Protein") >= 25) tags.push("high-protein");
  if (nutrientAmount(nutrients, "Fiber") >= 5) tags.push("high-fiber");
  if (nutrientAmount(nutrients, "Carbohydrates") <= 30) tags.push("low-carb");
  if (nutrientAmount(nutrients, "Calories") <= 450) tags.push("low-calorie");
  if (nutrientAmount(nutrients, "Fat") <= 12) tags.push("low-fat");
  return tags;
}

function inferCost(pricePerServing?: number): CostTier {
  if (!pricePerServing) return "medium";
  if (pricePerServing < 250) return "low";
  if (pricePerServing < 600) return "medium";
  return "high";
}

function mapSteps(data: SpoonacularRecipePayload): Localized[] {
  const analyzed = data.analyzedInstructions?.[0]?.steps;
  if (analyzed?.length) {
    return analyzed.map((step) => {
      const text = stripHtml(step.step);
      return { en: text, de: text };
    });
  }

  if (data.instructions) {
    const parts = stripHtml(data.instructions)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      return parts.map((text) => ({ en: text, de: text }));
    }
  }

  return [
    {
      en: "Full instructions are available on the recipe source.",
      de: "Die vollständige Anleitung ist in der Rezeptquelle verfügbar.",
    },
  ];
}

function mapSpoonacularRecipe(data: SpoonacularRecipePayload): Recipe {
  const title = data.title.trim();
  const description = stripHtml(data.summary ?? "");
  const ingredients = (data.extendedIngredients ?? []).map((ing) => ({
    en: formatIngredientLine(ing, "en"),
    de: formatIngredientLine(ing, "de"),
  }));

  const searchTerms = [
    ...title.toLowerCase().split(/\s+/),
    ...(data.extendedIngredients ?? []).flatMap((ing) =>
      (ing.nameClean || ing.name).toLowerCase().split(/\s+/),
    ),
  ];

  return {
    id: String(data.id),
    title: { en: title, de: title },
    description: { en: description, de: description },
    minutes: data.readyInMinutes ?? 30,
    servings: data.servings ?? 2,
    meals: inferMeals(data.dishTypes),
    tags: inferDietaryTags(data),
    nutrition: inferNutritionTags(data),
    cost: inferCost(data.pricePerServing),
    ingredients,
    steps: mapSteps(data),
    searchTerms: [...new Set(searchTerms.filter(Boolean))],
  };
}

function cacheRecipe(recipe: Recipe): void {
  recipeCache.set(recipe.id, recipe);
}

export function storeCachedRecipe(recipe: Recipe): void {
  cacheRecipe(recipe);
}

export function getCachedRecipe(id: string): Recipe | undefined {
  return recipeCache.get(id);
}

function buildDietParams(filters: DietaryTag[]): {
  diet?: string;
  intolerances?: string;
} {
  const intolerances: string[] = [];
  let diet: string | undefined;

  if (filters.includes("vegan")) diet = "vegan";
  else if (filters.includes("vegetarian")) diet = "vegetarian";

  if (filters.includes("gluten-free")) intolerances.push("gluten");
  if (filters.includes("dairy-free")) intolerances.push("dairy");
  if (filters.includes("nut-free")) intolerances.push("tree nut");

  return {
    diet,
    intolerances: intolerances.length ? intolerances.join(",") : undefined,
  };
}

function buildNutritionParams(
  nutrition: NutritionTag[],
): Record<string, number> {
  const params: Record<string, number> = {};
  if (nutrition.includes("high-protein")) params.minProtein = 25;
  if (nutrition.includes("high-fiber")) params.minFiber = 5;
  if (nutrition.includes("low-carb")) params.maxCarbs = 30;
  if (nutrition.includes("low-calorie")) params.maxCalories = 450;
  if (nutrition.includes("low-fat")) params.maxFat = 12;
  return params;
}

function mealTypeParam(mealType?: MealType): string | undefined {
  if (mealType === "breakfast") return "breakfast";
  if (mealType === "lunch" || mealType === "dinner") return "main course";
  return undefined;
}

function maxPriceParam(budget?: CostTier): number | undefined {
  if (budget === "low") return 3;
  if (budget === "medium") return 8;
  return undefined;
}

export async function fetchSpoonacularRecipes(
  args: SearchRecipesArgs,
): Promise<Recipe[]> {
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

  const fetchCount = Math.min(Math.max(maxResults * 2, 6), 12);
  const dietParams = buildDietParams(dietaryFilters);
  const nutritionParams = buildNutritionParams(nutrition);

  const queryEn = await toEnglishFoodQuery(
    query || availableIngredients.join(" "),
  );
  const availableEn = await toEnglishFoodTerms(availableIngredients);
  const excludeEn = await toEnglishFoodTerms(excludeIngredients);

  const baseParams = {
    number: fetchCount,
    addRecipeInformation: true,
    addRecipeInstructions: true,
    addRecipeNutrition: true,
    instructionsRequired: true,
    fillIngredients: true,
    sort: "popularity" as const,
    type: mealTypeParam(mealType),
    maxReadyTime: maxPrepTime,
    maxPrice: maxPriceParam(budget),
    ...dietParams,
    ...nutritionParams,
  };

  // Single-ingredient searches work better as query than strict includeIngredients.
  const useStrictInclude = availableEn.length > 1;

  let data = await spoonacularGet<ComplexSearchResponse>("/recipes/complexSearch", {
    ...baseParams,
    query: queryEn || undefined,
    includeIngredients: useStrictInclude ? availableEn.join(",") : undefined,
    excludeIngredients: excludeEn.length ? excludeEn.join(",") : undefined,
  });

  if (data.results.length === 0 && (availableEn.length > 0 || queryEn)) {
    const fallbackQuery = [queryEn, ...availableEn].filter(Boolean).join(" ");
    console.log("[spoonacular] retrying search with query:", fallbackQuery);
    data = await spoonacularGet<ComplexSearchResponse>("/recipes/complexSearch", {
      ...baseParams,
      query: fallbackQuery,
      excludeIngredients: excludeEn.length ? excludeEn.join(",") : undefined,
    });
  }

  if (data.results.length === 0) {
    console.log("[spoonacular] no results for", {
      queryEn,
      availableEn,
      dietaryFilters,
    });
  }

  const recipes = data.results
    .map((item) => {
      try {
        return mapSpoonacularRecipe(item);
      } catch (error) {
        console.warn("[spoonacular] skipped recipe", item.id, error);
        return null;
      }
    })
    .filter((recipe): recipe is Recipe => recipe !== null);
  for (const recipe of recipes) cacheRecipe(recipe);
  return recipes;
}

export async function fetchSpoonacularRecipeById(
  id: string,
): Promise<Recipe | undefined> {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return undefined;

  const cached = getCachedRecipe(id);
  if (cached) return cached;

  const data = await spoonacularGet<SpoonacularRecipePayload>(
    `/recipes/${numericId}/information`,
    { includeNutrition: true },
  );

  const recipe = mapSpoonacularRecipe(data);
  cacheRecipe(recipe);
  return recipe;
}
