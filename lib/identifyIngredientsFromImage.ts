import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { Lang } from "@/lib/recipes";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** ~4 MB decoded — keeps vision requests within reasonable token limits. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const resultSchema = z.object({
  ingredients: z
    .array(z.string())
    .describe("Simple food ingredient names visible in the image"),
});

export type IdentifyIngredientsInput = {
  imageBase64: string;
  mimeType: string;
  language: Lang;
};

export type IdentifyIngredientsSuccess = {
  count: number;
  ingredients: string[];
};

export type IdentifyIngredientsResult =
  | IdentifyIngredientsSuccess
  | { error: string };

function normalizeBase64(input: string): string {
  const trimmed = input.trim();
  const match = /^data:[^;]+;base64,(.+)$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).replace(/\s/g, "");
}

function estimateDecodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function dedupeIngredients(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/** Use OpenAI vision to list food ingredients visible in a photo. */
export async function identifyIngredientsFromImage(
  input: IdentifyIngredientsInput,
): Promise<IdentifyIngredientsResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { error: "OPENAI_API_KEY is not configured." };
  }

  const mimeType = input.mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    return {
      error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
    };
  }

  const imageBase64 = normalizeBase64(input.imageBase64);
  if (!imageBase64) {
    return { error: "No image data provided." };
  }

  const byteLength = estimateDecodedBytes(imageBase64);
  if (byteLength > MAX_IMAGE_BYTES) {
    return { error: "Image is too large. Please use a photo under 4 MB." };
  }

  const langName = input.language === "de" ? "German" : "English";

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: resultSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "You analyze photos of fridges, pantries, storage racks, or kitchen counters.",
                "List every food ingredient you can confidently identify.",
                "Use short, simple ingredient names suitable for recipe search.",
                `Return ingredient names in ${langName}.`,
                "One ingredient per array entry.",
                "Include fresh produce, dairy, meat, leftovers in containers, jars, and packaged foods when the food is identifiable.",
                "Skip non-food items, appliances, and unlabeled opaque containers.",
                "Do not guess ingredients you cannot see.",
              ].join(" "),
            },
            {
              type: "image",
              image: Buffer.from(imageBase64, "base64"),
              mediaType: mimeType,
            },
          ],
        },
      ],
    });

    const ingredients = dedupeIngredients(object.ingredients);
    console.log(
      `[identify] found ${ingredients.length} ingredient(s):`,
      ingredients,
    );

    return { count: ingredients.length, ingredients };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image analysis failed.";
    console.warn("[identify] OpenAI vision failed:", message);
    return { error: message };
  }
}
