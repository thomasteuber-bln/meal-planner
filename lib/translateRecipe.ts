import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { Recipe } from "./recipes";

const deCache = new Map<string, Recipe>();

const translationSchema = z.object({
  recipes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      ingredients: z.array(z.string()),
      steps: z.array(z.string()).optional(),
    }),
  ),
});

export interface LocalizeOptions {
  /** Skip step translation (faster; detail page translates on open). */
  skipSteps?: boolean;
}

export function hasGermanLocalization(recipe: Recipe): boolean {
  return recipe.title.de.trim() !== recipe.title.en.trim();
}

function applyGermanTranslation(
  recipe: Recipe,
  translated: z.infer<typeof translationSchema>["recipes"][number],
  skipSteps = false,
): Recipe {
  const deTerms = [
    ...translated.title.toLowerCase().split(/\s+/),
    ...translated.ingredients.flatMap((line) =>
      line.toLowerCase().split(/\s+/),
    ),
  ];

  return {
    ...recipe,
    title: { en: recipe.title.en, de: translated.title },
    description: { en: recipe.description.en, de: translated.description },
    ingredients: recipe.ingredients.map((ing, i) => ({
      en: ing.en,
      de: translated.ingredients[i] ?? ing.en,
    })),
    steps: skipSteps
      ? recipe.steps
      : recipe.steps.map((step, i) => ({
          en: step.en,
          de: translated.steps?.[i] ?? step.en,
        })),
    searchTerms: [...new Set([...recipe.searchTerms, ...deTerms.filter(Boolean)])],
  };
}

async function translateBatchWithOpenAI(
  recipes: Recipe[],
  options: LocalizeOptions = {},
): Promise<Recipe[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[translate] OPENAI_API_KEY not set; German recipe text falls back to English",
    );
    return recipes;
  }

  const skipSteps = options.skipSteps ?? false;
  const payload = recipes.map((r) => ({
    id: r.id,
    title: r.title.en,
    description: r.description.en,
    ingredients: r.ingredients.map((i) => i.en),
    ...(skipSteps ? {} : { steps: r.steps.map((s) => s.en) }),
  }));

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: translationSchema,
      prompt: [
        "Translate these recipes from English to German for a European meal-planner app.",
        "Rules:",
        "- Keep numeric amounts and metric units (g, ml, °C) unchanged.",
        "- Use TL and EL instead of tsp/tbsp in ingredient lines.",
        "- Return the same number of ingredient strings as each input recipe.",
        skipSteps
          ? "- Only translate title, description, and ingredients."
          : "- Return the same number of ingredient and step strings as each input recipe.",
        "- Use natural German cooking language; keep food names recognizable.",
        "Input JSON:",
        JSON.stringify(payload),
      ].join("\n"),
    });

    return recipes.map((recipe) => {
      const match = object.recipes.find((t) => t.id === recipe.id);
      if (!match) return recipe;
      return applyGermanTranslation(recipe, match, skipSteps);
    });
  } catch (error) {
    console.warn("[translate] OpenAI translation failed:", error);
    return recipes;
  }
}

/** Add German localized fields to recipes (cached by id). */
export async function localizeRecipesDe(
  recipes: Recipe[],
  options: LocalizeOptions = {},
): Promise<Recipe[]> {
  if (recipes.length === 0) return [];

  const skipSteps = options.skipSteps ?? false;

  if (skipSteps) {
    const pending = recipes.filter((recipe) => !hasGermanLocalization(recipe));
    if (pending.length === 0) return recipes;
    const translated = await translateBatchWithOpenAI(pending, { skipSteps: true });
    const byId = new Map(translated.map((recipe) => [recipe.id, recipe]));
    return recipes.map((recipe) => byId.get(recipe.id) ?? recipe);
  }

  const pending: Recipe[] = [];
  for (const recipe of recipes) {
    const cached = deCache.get(recipe.id);
    if (cached && hasGermanLocalization(cached)) continue;
    if (hasGermanLocalization(recipe)) {
      deCache.set(recipe.id, recipe);
      continue;
    }
    pending.push(recipe);
  }

  if (pending.length > 0) {
    const translated = await translateBatchWithOpenAI(pending);
    for (const recipe of translated) {
      deCache.set(recipe.id, recipe);
    }
  }

  return recipes.map((recipe) => deCache.get(recipe.id) ?? recipe);
}

export function getGermanCachedRecipe(id: string): Recipe | undefined {
  return deCache.get(id);
}
