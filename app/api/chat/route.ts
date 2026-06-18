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
import { preferencesToSearchHints } from "@/lib/profileOptions";
import { generateShoppingList } from "@/lib/shoppingList";
import { identifyIngredientsFromImage } from "@/lib/identifyIngredientsFromImage";
import {
  RecipeApiConfigError,
  RecipeApiError,
} from "@/lib/spoonacular";

type AttachedImage = {
  imageBase64: string;
  mimeType: string;
};

function extractAttachedImages(messages: UIMessage[]): AttachedImage[] {
  const images: AttachedImage[] = [];

  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type !== "file") continue;
      const mediaType = "mediaType" in part ? part.mediaType : undefined;
      if (!mediaType?.startsWith("image/")) continue;
      const url = "url" in part ? part.url : undefined;
      if (!url) continue;
      images.push({ imageBase64: url, mimeType: mediaType });
    }
  }

  return images;
}

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
  const uiLanguage = language === "de" ? "de" : "en";
  const attachedImages = extractAttachedImages(messages);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: [
      "You are a helpful recipe assistant for a guided meal-planner app.",
      `Always write your replies to the user in ${langName}.`,
      "The user has completed onboarding (diet, allergies, nutrition goal,",
      "dislikes, household size) and submits a structured request that already",
      "includes the meal type, cuisine & lifestyle preferences, preparation time,",
      "available ingredients, and budget.",
      "First call get_preferences to load their saved profile and `searchHints`.",
      "Then call search_recipes: merge `searchHints` (dietaryFilters, nutrition,",
      "query hints, excludeIngredients) with the request details (mealType,",
      "maxPrepTime, availableIngredients, budget). Append cuisine preferences from",
      "the request to the search `query` when helpful.",
      "Recipes are ranked by fewest missing ingredients (best pantry overlap).",
      "German ingredient names in the request are supported — they are translated for the recipe API automatically.",
      "Do NOT ask the user to re-enter cook time — it is already in the request.",
      "Budget is optional; omit it from search_recipes when the user chose no limit.",
      "Only ask a brief clarifying question if the request is truly missing the meal type.",
      "If the user asks to change a saved preference (diet, allergies,",
      "nutrition goal, or dislikes), call set_preferences to persist it, then continue.",
      "If the user asks for a shopping list for a recipe, call generate_shopping_list",
      "with the recipeId and their availableIngredients (from the request or message).",
      "If the user attaches a photo of their fridge, pantry, or storage and wants",
      "ingredients identified, call identify_ingredients_from_image (use attached",
      "image when no base64 is provided). Merge the result into availableIngredients",
      "for search_recipes when they ask for recipe recommendations.",
      "The app displays the search_recipes results as visual cards with full",
      "details (title, time, tags, ingredients). Do NOT list, number, name, or",
      "describe the individual recipes — the cards already show them. Reply with a",
      "single short paragraph (1-2 sentences) summarizing why these picks fit the",
      "request, then stop. For shopping lists, keep text brief — the app renders",
      "the list from generate_shopping_list output.",
      "For identify_ingredients_from_image, keep text brief — the app renders",
      "the ingredient list from tool output.",
    ].join(" "),
    messages: convertToModelMessages(messages),
    // Let the model call a tool and then continue with a follow-up reply.
    stopWhen: stepCountIs(5),
    tools: {
      get_preferences: tool({
        description:
          "Load the user's saved meal preferences (diet, allergies, nutrition goal, " +
          "dislikes, budget, household size, max cook time) from local storage. " +
          "Includes `searchHints` for mapping profile fields to " +
          "search_recipes filters. The `missing` array lists unset optional prefs.",
        inputSchema: z.object({}),
        execute: async () => {
          const { preferences, missing } = await readPreferences();
          const searchHints = preferencesToSearchHints(preferences);

          console.log("\n[tool] get_preferences called");
          console.log("[tool] get_preferences preferences:", preferences);
          console.log("[tool] get_preferences searchHints:", searchHints);
          console.log(
            "[tool] get_preferences missing:",
            missing.length ? missing : "(none)",
          );

          return { preferences, missing, searchHints };
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
            .describe("Lifestyle diet, e.g. ['vegetarian'] or ['pescetarian']"),
          allergies: z
            .array(z.string())
            .optional()
            .describe(
              "Allergies/intolerances, e.g. ['gluten-free', 'lactose-free']",
            ),
          dislikes: z
            .array(z.string())
            .optional()
            .describe("Ingredients to avoid, e.g. ['cilantro']"),
          nutritionGoal: z
            .string()
            .nullable()
            .optional()
            .describe(
              "Nutrition goal: balanced, low-carb, high-protein, high-fiber, low-calorie, or low-fat",
            ),
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
          availableIngredients: z
            .array(z.string())
            .optional()
            .describe(
              "Ingredients the user already has on hand (fuzzy overlap ranking)",
            ),
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

          try {
            const recipes = await searchRecipes({
              query: input.query,
              dietaryFilters: input.dietaryFilters as DietaryTag[] | undefined,
              mealType: input.mealType as MealType | undefined,
              maxPrepTime: input.maxPrepTime,
              nutrition: input.nutrition as NutritionTag[] | undefined,
              budget: input.budget as CostTier | undefined,
              availableIngredients: input.availableIngredients,
              excludeIngredients: input.excludeIngredients,
              maxResults: input.maxResults,
            });

            console.log(
              `[tool] search_recipes returning ${recipes.length} recipe(s):`,
              recipes.map((r) => r.title),
            );

            return { count: recipes.length, recipes };
          } catch (error) {
            const message =
              error instanceof RecipeApiConfigError ||
              error instanceof RecipeApiError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : "Recipe search failed.";
            console.log("[tool] search_recipes error:", message);
            return { count: 0, recipes: [], error: message };
          }
        },
      }),
      identify_ingredients_from_image: tool({
        description:
          "Analyze a photo of a fridge, pantry, or food storage and list visible " +
          "food ingredients. Use when the user uploads or references a kitchen photo. " +
          "Omit imageBase64 to analyze the user's attached chat image.",
        inputSchema: z.object({
          imageBase64: z
            .string()
            .optional()
            .describe(
              "Base64 image data or data URL. Omit to use the user's attached photo.",
            ),
          mimeType: z
            .string()
            .optional()
            .describe("MIME type, e.g. image/jpeg. Required with imageBase64."),
          imageIndex: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe(
              "Which attached user image to analyze when imageBase64 is omitted (default 0).",
            ),
        }),
        execute: async (input) => {
          console.log("\n[tool] identify_ingredients_from_image called");

          let imageBase64 = input.imageBase64;
          let mimeType = input.mimeType;

          if (!imageBase64) {
            const index = input.imageIndex ?? 0;
            const attached = attachedImages[index];
            if (!attached) {
              const message = "No image attached. Ask the user to upload a photo.";
              console.log("[tool] identify_ingredients_from_image error:", message);
              return { count: 0, ingredients: [], error: message };
            }
            imageBase64 = attached.imageBase64;
            mimeType = attached.mimeType;
          }

          if (!mimeType) {
            const message = "mimeType is required when providing imageBase64.";
            console.log("[tool] identify_ingredients_from_image error:", message);
            return { count: 0, ingredients: [], error: message };
          }

          const result = await identifyIngredientsFromImage({
            imageBase64,
            mimeType,
            language: uiLanguage,
          });

          if ("error" in result) {
            console.log(
              "[tool] identify_ingredients_from_image error:",
              result.error,
            );
            return { count: 0, ingredients: [], error: result.error };
          }

          console.log(
            `[tool] identify_ingredients_from_image found ${result.count} ingredient(s):`,
            result.ingredients,
          );

          return result;
        },
      }),
      generate_shopping_list: tool({
        description:
          "Build a shopping list of missing ingredients for a recipe, given what " +
          "the user already has. Scales amounts to household size from preferences.",
        inputSchema: z.object({
          recipeId: z
            .string()
            .describe("Recipe id from search_recipes results, e.g. 'r1'"),
          availableIngredients: z
            .array(z.string())
            .describe("Ingredients the user already has on hand"),
        }),
        execute: async (input) => {
          console.log("\n[tool] generate_shopping_list called with:", input);

          const { preferences } = await readPreferences();
          const result = await generateShoppingList({
            recipeId: input.recipeId,
            availableIngredients: input.availableIngredients,
            householdSize: preferences.householdSize,
          });

          if ("error" in result) {
            console.log("[tool] generate_shopping_list error:", result.error);
            return result;
          }

          console.log(
            `[tool] generate_shopping_list missing ${result.missingCount} item(s) for`,
            result.recipeTitle.en,
          );

          return result;
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
