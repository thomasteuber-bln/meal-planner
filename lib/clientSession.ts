import type { Lang, Recipe } from "./recipes";

const RESULTS_KEY = "meal-planner-results";
const RECIPE_PREFIX = "meal-planner-recipe:";

interface ResultsSession {
  messages: unknown[];
  availableIngredients: string[];
  lang: Lang;
}

export function cacheRecipeForDetail(recipe: Recipe): void {
  try {
    sessionStorage.setItem(`${RECIPE_PREFIX}${recipe.id}`, JSON.stringify(recipe));
  } catch {
    // ignore quota errors
  }
}

export function getCachedRecipeFromSession(id: string): Recipe | null {
  try {
    const raw = sessionStorage.getItem(`${RECIPE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Recipe;
  } catch {
    return null;
  }
}

export function persistResultsSession(data: ResultsSession): void {
  try {
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function restoreResultsSession(): ResultsSession | null {
  try {
    const raw = sessionStorage.getItem(RESULTS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResultsSession;
  } catch {
    return null;
  }
}

export function clearResultsSession(): void {
  try {
    sessionStorage.removeItem(RESULTS_KEY);
  } catch {
    // ignore
  }
}
