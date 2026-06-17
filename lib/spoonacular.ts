import type {
  CostTier,
  DietaryTag,
  Localized,
  MealType,
  NutritionTag,
  Recipe,
  SearchRecipesArgs,
} from "./recipes";

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
  const quotaUsed = res.headers.get("X-API-Quota-Used");
  const quotaLeft = res.headers.get("X-API-Quota-Left");
  if (quotaUsed && quotaLeft) {
    console.log(`[spoonacular] quota used today: ${quotaUsed}, left: ${quotaLeft}`);
  }
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


function buildPoolSearchParams(args: {
  dietaryFilters: DietaryTag[];
  excludeEn: string[];
  fetchCount: number;
}) {
  const dietParams = buildDietParams(args.dietaryFilters);
  return {
    number: args.fetchCount,
    addRecipeInformation: true,
    addRecipeInstructions: false,
    addRecipeNutrition: false,
    instructionsRequired: false,
    fillIngredients: false,
    sort: "popularity" as const,
    excludeIngredients: args.excludeEn.length ? args.excludeEn.join(",") : undefined,
    ...dietParams,
  };
}

export function isFullRecipe(recipe: Recipe): boolean {
  const step = recipe.steps[0]?.en ?? "";
  return !step.startsWith("Full instructions are available");
}

function mapSearchResults(data: ComplexSearchResponse): Recipe[] {
  return data.results
    .map((item) => {
      try {
        return mapSpoonacularRecipe(item);
      } catch (error) {
        console.warn("[spoonacular] skipped recipe", item.id, error);
        return null;
      }
    })
    .filter((recipe): recipe is Recipe => recipe !== null);
}

async function complexSearch(
  params: Record<string, string | number | boolean | undefined>,
): Promise<ComplexSearchResponse> {
  return spoonacularGet<ComplexSearchResponse>("/recipes/complexSearch", params);
}

async function fetchRecipePool(
  poolParams: ReturnType<typeof buildPoolSearchParams>,
  query: string,
): Promise<Recipe[]> {
  if (query.trim()) {
    const data = await complexSearch({ ...poolParams, query: query.trim() });
    const recipes = mapSearchResults(data);
    if (recipes.length > 0) return recipes;
  }

  console.log("[spoonacular] retrying with no query (diet/exclude only)");
  const data = await complexSearch(poolParams);
  return mapSearchResults(data);
}

export interface PreparedSearchTerms {
  availableEn: string[];
  excludeEn: string[];
  queryEn: string;
}

export async function fetchSpoonacularRecipes(
  args: SearchRecipesArgs,
  terms: PreparedSearchTerms,
): Promise<Recipe[]> {
  const {
    dietaryFilters = [],
    availableIngredients = [],
    maxResults = 5,
  } = args;

  const hasPantry = availableIngredients.length > 0;
  const fetchCount = hasPantry ? 8 : Math.min(Math.max(maxResults * 2, 6), 8);

  const { availableEn, excludeEn, queryEn } = terms;

  const poolParams = buildPoolSearchParams({
    dietaryFilters,
    excludeEn,
    fetchCount,
  });

  const searchQuery = hasPantry
    ? [...availableEn, queryEn].filter(Boolean).join(" ")
    : queryEn;

  const recipes = await fetchRecipePool(poolParams, searchQuery);

  if (recipes.length === 0) {
    console.log("[spoonacular] no results for", {
      queryEn,
      availableEn,
      dietaryFilters,
    });
  }

  for (const recipe of recipes) {
    const cached = getCachedRecipe(recipe.id);
    if (!cached || !isFullRecipe(cached)) {
      cacheRecipe(recipe);
    }
  }
  return recipes;
}

export async function enrichRecipesForDisplay(
  recipes: Recipe[],
): Promise<Recipe[]> {
  const needsFetch = recipes.filter((recipe) => {
    const cached = getCachedRecipe(recipe.id);
    return !cached || !isFullRecipe(cached);
  });
  if (needsFetch.length === 0) {
    return recipes.map((recipe) => getCachedRecipe(recipe.id) ?? recipe);
  }

  const ids = needsFetch.map((recipe) => recipe.id).join(",");
  const data = await spoonacularGet<SpoonacularRecipePayload[]>(
    "/recipes/informationBulk",
    { ids, includeNutrition: false },
  );

  const byId = new Map<string, Recipe>();
  for (const item of data) {
    try {
      const recipe = mapSpoonacularRecipe(item);
      cacheRecipe(recipe);
      byId.set(recipe.id, recipe);
    } catch (error) {
      console.warn("[spoonacular] skipped bulk recipe", item.id, error);
    }
  }

  return recipes.map((recipe) => byId.get(recipe.id) ?? getCachedRecipe(recipe.id) ?? recipe);
}

export async function fetchSpoonacularRecipeById(
  id: string,
): Promise<Recipe | undefined> {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return undefined;

  const cached = getCachedRecipe(id);
  if (cached && isFullRecipe(cached)) return cached;

  const data = await spoonacularGet<SpoonacularRecipePayload>(
    `/recipes/${numericId}/information`,
    { includeNutrition: true },
  );

  const recipe = mapSpoonacularRecipe(data);
  cacheRecipe(recipe);
  return recipe;
}
