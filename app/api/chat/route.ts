import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  searchRecipes,
  type CostTier,
  type DietaryTag,
  type MealType,
  type NutritionTag,
} from "@/lib/recipes";
import { readPreferences, writePreferences } from "@/lib/preferences";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const dietaryTag = z.enum([
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
]);

const nutritionTag = z.enum([
  "high-protein",
  "high-fiber",
  "low-carb",
  "low-calorie",
  "low-fat",
]);

const mealType = z.enum(["breakfast", "lunch", "dinner"]);

const costTier = z.enum(["low", "medium", "high"]);

export async function POST(req: Request) {
  const {
    messages,
    language,
  }: { messages: UIMessage[]; language?: "en" | "de" } = await req.json();

  const langName = language === "de" ? "German" : "English";

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: [
      "You are a helpful recipe assistant for a guided meal-planner app.",
      `Always write your replies to the user in ${langName}.`,
      "The user has completed onboarding (diet, dislikes, household size) and",
      "submits a structured request that already includes the meal type,",
      "preparation time, preferred ingredients, nutrition goals, and budget.",
      "First call get_preferences to load their saved diet and dislikes.",
      "Then call search_recipes: map the saved diet to `dietaryFilters`, saved",
      "dislikes to `excludeIngredients`, and the request details to the matching",
      "arguments (mealType, maxPrepTime, preferredIngredients, nutrition, budget).",
      "Do NOT ask the user to re-enter budget or cook time — they are already in",
      "the request. Only ask a brief clarifying question if the request is truly",
      "missing the meal type. Never invent dietary values.",
      "If the user asks to change a saved preference (diet or dislikes), call",
      "set_preferences to persist it, then continue.",
      "The app displays the search_recipes results as visual cards with full",
      "details (title, time, tags, ingredients). Do NOT list, number, name, or",
      "describe the individual recipes — the cards already show them. Reply with a",
      "single short paragraph (1-2 sentences) summarizing why these picks fit the",
      "request, then stop.",
    ].join(" "),
    messages: convertToModelMessages(messages),
    // Let the model call a tool and then continue with a follow-up reply.
    stopWhen: stepCountIs(5),
    tools: {
      get_preferences: tool({
        description:
          "Load the user's saved meal preferences (diet, dislikes, budget, " +
          "household size, max cook time) from local storage. The result " +
          "includes a `missing` array listing any preferences that are not set " +
          "yet; ask the user about those before recommending meals.",
        inputSchema: z.object({}),
        execute: async () => {
          const { preferences, missing } = await readPreferences();

          console.log("\n[tool] get_preferences called");
          console.log("[tool] get_preferences preferences:", preferences);
          console.log(
            "[tool] get_preferences missing:",
            missing.length ? missing : "(none)",
          );

          return { preferences, missing };
        },
      }),
      set_preferences: tool({
        description:
          "Save or update the user's meal preferences to local storage. Only " +
          "include the fields you want to change; omitted fields are kept as-is. " +
          "Call this after the user tells you a preference (e.g. their budget or " +
          "max cook time) or asks to change one.",
        inputSchema: z.object({
          diet: z
            .array(z.string())
            .optional()
            .describe("Dietary preferences, e.g. ['vegetarian']"),
          dislikes: z
            .array(z.string())
            .optional()
            .describe("Ingredients to avoid, e.g. ['cilantro']"),
          budget: z
            .string()
            .optional()
            .describe("Budget, e.g. 'cheap', '$15 per meal', or 'no limit'"),
          householdSize: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Number of people to cook for"),
          maxCookTime: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Maximum cook time in minutes"),
        }),
        execute: async (update) => {
          console.log("\n[tool] set_preferences called with:", update);

          const { preferences, missing } = await writePreferences(update);

          console.log("[tool] set_preferences saved:", preferences);
          console.log(
            "[tool] set_preferences still missing:",
            missing.length ? missing : "(none)",
          );

          return { saved: true, preferences, missing };
        },
      }),
      search_recipes: tool({
        description:
          "Search a recipe database. All filters are optional; provide whatever " +
          "the request specifies. Returns 3-5 matching recipes.",
        inputSchema: z.object({
          query: z
            .string()
            .optional()
            .describe("Free-text description of what the user wants"),
          dietaryFilters: z
            .array(dietaryTag)
            .optional()
            .describe("Dietary restrictions the recipes must satisfy (from saved diet)"),
          mealType: mealType
            .optional()
            .describe("Which meal: breakfast, lunch, or dinner"),
          maxPrepTime: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Maximum total prep/cook time in minutes"),
          nutrition: z
            .array(nutritionTag)
            .optional()
            .describe("Nutritional goals the recipes should meet"),
          budget: costTier
            .optional()
            .describe("Budget tier: low (cheap), medium, or high"),
          preferredIngredients: z
            .array(z.string())
            .optional()
            .describe("Ingredients the user would like to include (used to rank)"),
          excludeIngredients: z
            .array(z.string())
            .optional()
            .describe("Ingredients to avoid (from saved dislikes)"),
          maxResults: z
            .number()
            .int()
            .min(3)
            .max(5)
            .optional()
            .describe("How many recipes to return (3-5)"),
        }),
        execute: async (input) => {
          console.log("\n[tool] search_recipes called with:", input);

          const recipes = searchRecipes({
            query: input.query,
            dietaryFilters: input.dietaryFilters as DietaryTag[] | undefined,
            mealType: input.mealType as MealType | undefined,
            maxPrepTime: input.maxPrepTime,
            nutrition: input.nutrition as NutritionTag[] | undefined,
            budget: input.budget as CostTier | undefined,
            preferredIngredients: input.preferredIngredients,
            excludeIngredients: input.excludeIngredients,
            maxResults: input.maxResults,
          });

          console.log(
            `[tool] search_recipes returning ${recipes.length} recipe(s):`,
            recipes.map((r) => r.title),
          );

          return { count: recipes.length, recipes };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
