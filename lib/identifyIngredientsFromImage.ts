import { openai } from "@ai-sdk/openai";
import { generateObject, NoObjectGeneratedError } from "ai";
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

/** Structured output prefers object entries; models sometimes emit plain strings instead. */
const resultSchema = z.object({
  ingredients: z.array(
    z.object({
      name: z
        .string()
        .describe("Simple food ingredient name visible in the image"),
    }),
  ),
});

function coerceIngredients(raw: unknown): string[] {
  const source =
    raw && typeof raw === "object" && "ingredients" in raw
      ? (raw as { ingredients: unknown }).ingredients
      : raw;

  if (typeof source === "string") {
    return source
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(source)) return [];

  return source.flatMap((item) => {
    if (typeof item === "string") {
      const cleaned = item.trim();
      return cleaned ? [cleaned] : [];
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      for (const key of ["name", "ingredient", "item", "label"] as const) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return [value.trim()];
      }
    }
    return [];
  });
}

function parseIngredientsFromModelText(text: string | undefined): string[] | null {
  if (!text?.trim()) return null;

  const candidates = [text.trim()];
  const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (jsonBlock?.[1]) candidates.push(jsonBlock[1].trim());
  const braceMatch = /\{[\s\S]*\}/.exec(text);
  if (braceMatch?.[0]) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const ingredients = dedupeIngredients(coerceIngredients(parsed));
      if (ingredients.length > 0) return ingredients;
    } catch {
      // try next candidate
    }
  }

  return null;
}

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

  const visionPrompt = [
    "You analyze photos of fridges, pantries, storage racks, or kitchen counters.",
    "List every food ingredient you can confidently identify.",
    "Use short, simple ingredient names suitable for recipe search.",
    `Return ingredient names in ${langName}.`,
    'Return JSON: { "ingredients": [ { "name": "..." }, ... ] }.',
    "One ingredient per array entry.",
    "Include fresh produce, dairy, meat, leftovers in containers, jars, and packaged foods when the food is identifiable.",
    "Skip non-food items, appliances, and unlabeled opaque containers.",
    "Do not guess ingredients you cannot see.",
  ].join(" ");

  const visionMessages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: visionPrompt },
        {
          type: "image" as const,
          image: Buffer.from(imageBase64, "base64"),
          mediaType: mimeType,
        },
      ],
    },
  ];

  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: resultSchema,
        schemaName: "IngredientList",
        schemaDescription:
          "Food ingredients visible in a kitchen photo, one name per entry.",
        messages: visionMessages,
      });

      const ingredients = dedupeIngredients(
        object.ingredients.map((entry) => entry.name),
      );
      console.log(
        `[identify] found ${ingredients.length} ingredient(s):`,
        ingredients,
      );

      return { count: ingredients.length, ingredients };
    } catch (error) {
      lastError = error;

      const recovered = NoObjectGeneratedError.isInstance(error)
        ? parseIngredientsFromModelText(error.text)
        : null;
      if (recovered) {
        console.warn(
          `[identify] recovered ${recovered.length} ingredient(s) from raw model text`,
        );
        return { count: recovered.length, ingredients: recovered };
      }

      if (attempt < 2) {
        console.warn("[identify] schema mismatch, retrying once");
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Image analysis failed.";
  console.warn("[identify] OpenAI vision failed:", message);
  return {
    error:
      "Could not read ingredients from this photo. Please try again or use a clearer picture.",
  };
}
