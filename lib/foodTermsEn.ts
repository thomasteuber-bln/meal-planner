import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/** Common German → English food terms (no API call needed). */
const DE_FOOD_EN: Record<string, string> = {
  kartoffel: "potato",
  kartoffeln: "potatoes",
  reis: "rice",
  nudeln: "pasta",
  pasta: "pasta",
  tomate: "tomato",
  tomaten: "tomatoes",
  zwiebel: "onion",
  zwiebeln: "onions",
  knoblauch: "garlic",
  spinat: "spinach",
  paprika: "bell pepper",
  käse: "cheese",
  kaese: "cheese",
  ei: "egg",
  eier: "eggs",
  milch: "milk",
  hähnchen: "chicken",
  haehnchen: "chicken",
  huhn: "chicken",
  hühnchen: "chicken",
  rind: "beef",
  rindfleisch: "beef",
  schwein: "pork",
  schweinefleisch: "pork",
  lachs: "salmon",
  fisch: "fish",
  tofu: "tofu",
  brokkoli: "broccoli",
  karotte: "carrot",
  karotten: "carrots",
  möhre: "carrot",
  moehre: "carrot",
  möhren: "carrots",
  moehren: "carrots",
  pilz: "mushroom",
  pilze: "mushrooms",
  champignon: "mushroom",
  champignons: "mushrooms",
  bohnen: "beans",
  kichererbsen: "chickpeas",
  linse: "lentil",
  linsen: "lentils",
  avocado: "avocado",
  zitrone: "lemon",
  limette: "lime",
  gurke: "cucumber",
  gurken: "cucumbers",
  zucchini: "zucchini",
  aubergine: "eggplant",
  kürbis: "pumpkin",
  kuerbis: "pumpkin",
  süßkartoffel: "sweet potato",
  suesskartoffel: "sweet potato",
  quinoa: "quinoa",
  haferflocken: "oats",
  joghurt: "yogurt",
  sahne: "cream",
  butter: "butter",
  olivenöl: "olive oil",
  olivenoel: "olive oil",
  öl: "oil",
  oel: "oil",
  mehl: "flour",
  zucker: "sugar",
  honig: "honey",
  basilikum: "basil",
  petersilie: "parsley",
  koriander: "cilantro",
  thymian: "thyme",
  rosmarin: "rosemary",
  ingwer: "ginger",
  chili: "chili",
  mais: "corn",
  erbsen: "peas",
  spargel: "asparagus",
  lauch: "leek",
  sellerie: "celery",
  salat: "lettuce",
  apfel: "apple",
  äpfel: "apples",
  aepfel: "apples",
  banane: "banana",
  bananen: "bananas",
  beeren: "berries",
  erdbeeren: "strawberries",
  nüsse: "nuts",
  nuesse: "nuts",
  mandeln: "almonds",
  feta: "feta",
  mozzarella: "mozzarella",
  parmesan: "parmesan",
  tortillias: "tortillas",
  tortilla: "tortilla",
};

const termCache = new Map<string, string>();

const termsSchema = z.object({
  terms: z.array(
    z.object({
      source: z.string(),
      english: z.string(),
    }),
  ),
});

function normalizeKey(term: string): string {
  return term.trim().toLowerCase();
}

async function translateUnknownTermsWithOpenAI(
  terms: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || terms.length === 0) return out;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: termsSchema,
      prompt: [
        "Translate these food ingredient or recipe search terms to English for a recipe API.",
        "Return one english string per source term. Use simple ingredient names.",
        "Terms:",
        JSON.stringify(terms),
      ].join("\n"),
    });

    for (const { source, english } of object.terms) {
      out.set(source, english.trim());
      termCache.set(normalizeKey(source), english.trim());
    }
  } catch (error) {
    console.warn("[foodTerms] OpenAI translation failed:", error);
  }

  return out;
}

/** Map German (or mixed) food terms to English for Spoonacular. */
export async function toEnglishFoodTerms(terms: string[]): Promise<string[]> {
  if (terms.length === 0) return [];

  const unknown: string[] = [];
  const resolved = new Map<string, string>();

  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;

    const key = normalizeKey(trimmed);
    if (termCache.has(key)) {
      resolved.set(trimmed, termCache.get(key)!);
      continue;
    }

    const staticMatch = DE_FOOD_EN[key];
    if (staticMatch) {
      termCache.set(key, staticMatch);
      resolved.set(trimmed, staticMatch);
      continue;
    }

    unknown.push(trimmed);
  }

  if (unknown.length > 0) {
    const ai = await translateUnknownTermsWithOpenAI(unknown);
    for (const term of unknown) {
      resolved.set(term, ai.get(term) ?? term);
    }
  }

  return terms
    .map((term) => resolved.get(term.trim()) ?? term.trim())
    .filter(Boolean);
}

export async function toEnglishFoodQuery(query: string): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "";

  const parts = trimmed.split(/[\s,;+/]+/).filter(Boolean);
  if (parts.length <= 1) {
    const [en] = await toEnglishFoodTerms([trimmed]);
    return en;
  }

  const translated = await toEnglishFoodTerms(parts);
  return translated.join(" ");
}
