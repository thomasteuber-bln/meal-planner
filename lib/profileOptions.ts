import type { DietaryTag, NutritionTag } from "./recipes";
import type { Preferences } from "./preferences";

/** Lifestyle / ethical diet choices (onboarding). */
export type DietStyle =
  | "vegetarian"
  | "vegan"
  | "pescetarian"
  | "flexitarian"
  | "carnivore";

export const DIET_STYLE_OPTIONS: DietStyle[] = [
  "vegetarian",
  "vegan",
  "pescetarian",
  "flexitarian",
  "carnivore",
];

/** Intolerances and common allergies (onboarding). */
export type AllergyTag =
  | "gluten-free"
  | "lactose-free"
  | "nut-free"
  | "shellfish-free"
  | "egg-free"
  | "soy-free";

export const ALLERGY_OPTIONS: AllergyTag[] = [
  "gluten-free",
  "lactose-free",
  "nut-free",
  "shellfish-free",
  "egg-free",
  "soy-free",
];

/** Cuisine and lifestyle cooking preferences (per recipe request). */
export type CuisinePreference =
  | "mediterranean"
  | "asian"
  | "keto"
  | "paleo"
  | "mexican"
  | "italian"
  | "indian"
  | "comfort-food";

export const CUISINE_OPTIONS: CuisinePreference[] = [
  "mediterranean",
  "asian",
  "keto",
  "paleo",
  "mexican",
  "italian",
  "indian",
  "comfort-food",
];

/** Saved nutrition goal (onboarding). */
export type NutritionGoal =
  | "balanced"
  | "low-carb"
  | "high-protein"
  | "high-fiber"
  | "low-calorie"
  | "low-fat";

export const NUTRITION_GOAL_OPTIONS: NutritionGoal[] = [
  "balanced",
  "low-carb",
  "high-protein",
  "high-fiber",
  "low-calorie",
  "low-fat",
];

/** Macro split as percent of daily calories (must sum to 100). */
export interface MacroPercents {
  carbs: number;
  protein: number;
  fat: number;
}

/**
 * Target macro splits per nutrition goal.
 * Balanced uses AMDR midpoints (IOM 2002/2005): carbs 45–65%, protein 10–35%, fat 20–35%.
 * Other goals shift within or below those evidence-based ranges.
 */
export const NUTRITION_GOAL_MACROS: Record<NutritionGoal, MacroPercents> = {
  // AMDR midpoints: 50% / 20% / 30%
  balanced: { carbs: 50, protein: 20, fat: 30 },
  // Below AMDR carb floor (<45%); moderate low-carb, not ketogenic
  "low-carb": { carbs: 25, protein: 30, fat: 45 },
  // Upper AMDR protein band for satiety and muscle support
  "high-protein": { carbs: 40, protein: 30, fat: 30 },
  // Upper-mid AMDR carbs from fiber-rich whole foods
  "high-fiber": { carbs: 55, protein: 20, fat: 25 },
  // Elevated protein for satiety during calorie reduction
  "low-calorie": { carbs: 45, protein: 30, fat: 25 },
  // AMDR fat lower bound (20%)
  "low-fat": { carbs: 55, protein: 25, fat: 20 },
};

/** Map cuisine selections to Spoonacular query hints. */
export function cuisineToQueryHints(cuisines: string[]): string[] {
  const cuisineQueries: Record<CuisinePreference, string> = {
    mediterranean: "mediterranean",
    asian: "asian",
    keto: "keto low carb",
    paleo: "paleo",
    mexican: "mexican",
    italian: "italian",
    indian: "indian curry",
    "comfort-food": "comfort food",
  };

  return cuisines.flatMap(
    (c) => cuisineQueries[c as CuisinePreference] ?? c,
  );
}

const LEGACY_ALLERGY_IN_DIET = new Set([
  "gluten-free",
  "dairy-free",
  "nut-free",
]);

/** Split legacy combined `diet` arrays into lifestyle + allergies. */
export function normalizeStoredPreferences(
  raw: Partial<Preferences>,
): Preferences {
  const diet = [...(raw.diet ?? [])];
  const allergies = [...(raw.allergies ?? [])];

  const lifestyle = diet.filter((d): d is DietStyle =>
    DIET_STYLE_OPTIONS.includes(d as DietStyle),
  );
  const legacyAllergies = diet.filter((d) => LEGACY_ALLERGY_IN_DIET.has(d));

  for (const tag of legacyAllergies) {
    const mapped = tag === "dairy-free" ? "lactose-free" : tag;
    if (!allergies.includes(mapped as AllergyTag)) {
      allergies.push(mapped as AllergyTag);
    }
  }

  return {
    diet: lifestyle.length ? lifestyle : null,
    allergies: allergies.length ? allergies : null,
    dislikes: raw.dislikes ?? null,
    nutritionGoal: raw.nutritionGoal ?? null,
    budget: raw.budget ?? null,
    householdSize: raw.householdSize ?? null,
    maxCookTime: raw.maxCookTime ?? null,
    onboarded: raw.onboarded ?? false,
  };
}

/** Map saved profile fields to recipe-search arguments. */
export function preferencesToSearchHints(prefs: Preferences): {
  dietaryFilters: DietaryTag[];
  nutrition: NutritionTag[];
  queryHints: string[];
  excludeIngredients: string[];
} {
  const dietaryFilters: DietaryTag[] = [];
  const nutrition: NutritionTag[] = [];
  const queryHints: string[] = [];
  const excludeIngredients = [...(prefs.dislikes ?? [])];

  for (const style of prefs.diet ?? []) {
    if (style === "vegetarian") dietaryFilters.push("vegetarian");
    if (style === "vegan") dietaryFilters.push("vegan");
    if (style === "pescetarian") queryHints.push("fish seafood");
    if (style === "flexitarian") queryHints.push("vegetables legumes");
    if (style === "carnivore") queryHints.push("meat steak");
  }

  for (const allergy of prefs.allergies ?? []) {
    if (allergy === "gluten-free") dietaryFilters.push("gluten-free");
    if (allergy === "lactose-free") dietaryFilters.push("dairy-free");
    if (allergy === "nut-free") dietaryFilters.push("nut-free");
    if (allergy === "shellfish-free") excludeIngredients.push("shellfish", "shrimp");
    if (allergy === "egg-free") excludeIngredients.push("egg");
    if (allergy === "soy-free") excludeIngredients.push("soy", "tofu");
  }

  if (prefs.nutritionGoal && prefs.nutritionGoal !== "balanced") {
    nutrition.push(prefs.nutritionGoal as NutritionTag);
  }

  return {
    dietaryFilters: [...new Set(dietaryFilters)],
    nutrition: [...new Set(nutrition)],
    queryHints,
    excludeIngredients: [...new Set(excludeIngredients)],
  };
}
