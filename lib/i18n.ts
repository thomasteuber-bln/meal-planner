import type {
  DietaryTag,
  Lang,
  MealType,
  NutritionTag,
} from "@/lib/recipes";

export type { Lang };

type Dict = Record<string, string>;

const en = {
  appTitle: "Meal Planner",
  loading: "Loading…",

  noDietLimits: "no diet limits",
  avoiding: "avoiding",
  forPeople: "for",

  onboardTitle: "Welcome! Let's set up your kitchen",
  onboardSubtitle:
    "Tell us a bit about you. We'll remember this for every recommendation.",
  dietLabel: "Dietary preferences",
  dietHint: "Pick any that apply, or none.",
  dislikesLabel: "Dislikes / allergies",
  dislikesPlaceholder: "e.g. cilantro, olives, shellfish",
  dislikesHint: "Comma-separated ingredients to avoid.",
  householdLabel: "Household size",
  householdHint: "How many people are you cooking for?",
  save: "Save & continue",
  saving: "Saving…",

  requestTitle: "What are you in the mood for?",
  requestSubtitle: "We'll match recipes to your saved diet and dislikes.",
  editPreferences: "Edit preferences",
  mealLabel: "Type of meal",
  prepLabel: "Preparation time",
  prepQuick: "Quick (≤ 15 min)",
  prepMedium: "Medium (≤ 30 min)",
  prepRelaxed: "Relaxed (≤ 45 min)",
  prepAny: "Any",
  ingredientsLabel: "Available ingredients",
  ingredientsPlaceholder: "e.g. chicken, rice, broccoli",
  ingredientsHint: "Optional, comma-separated. We rank recipes by what you already have.",
  nutritionLabel: "Nutritional goals",
  budgetLabel: "Budget",
  submit: "Get recommendations",
  submitting: "Finding recipes…",

  newRecommendation: "← New recommendation",
  thinking: "Thinking…",
  followupPlaceholder: "Refine, e.g. 'make it cheaper' or 'no mushrooms'",
  send: "Send",
  yourRequest: "Your request",
  chef: "Chef",

  servings: "servings",
  minutesShort: "min",
  ingredientsHeading: "Ingredients",
  shoppingListButton: "Shopping list",
  shoppingListHeading: "Shopping list",
  shoppingListFor: "For",
  shoppingListAllAvailable: "You already have everything for this recipe.",
  shoppingListMissing: "Items to buy",
  instructionsHeading: "Instructions",
  viewRecipe: "View recipe",
  back: "Back",
  backToResults: "Back to results",
  recipeNotFound: "Recipe not found",
} satisfies Dict;

const de: typeof en = {
  appTitle: "Essensplaner",
  loading: "Lädt…",

  noDietLimits: "keine Einschränkungen",
  avoiding: "vermeidet",
  forPeople: "für",

  onboardTitle: "Willkommen! Richte deine Küche ein",
  onboardSubtitle:
    "Erzähl uns kurz von dir. Wir merken uns das für jede Empfehlung.",
  dietLabel: "Ernährungsweise",
  dietHint: "Wähle, was zutrifft – oder nichts.",
  dislikesLabel: "Abneigungen / Allergien",
  dislikesPlaceholder: "z. B. Koriander, Oliven, Meeresfrüchte",
  dislikesHint: "Zutaten zum Vermeiden, durch Komma getrennt.",
  householdLabel: "Haushaltsgröße",
  householdHint: "Für wie viele Personen kochst du?",
  save: "Speichern & weiter",
  saving: "Speichert…",

  requestTitle: "Worauf hast du Lust?",
  requestSubtitle:
    "Wir gleichen Rezepte mit deiner gespeicherten Ernährung und Abneigungen ab.",
  editPreferences: "Einstellungen bearbeiten",
  mealLabel: "Art der Mahlzeit",
  prepLabel: "Zubereitungszeit",
  prepQuick: "Schnell (≤ 15 Min.)",
  prepMedium: "Mittel (≤ 30 Min.)",
  prepRelaxed: "Entspannt (≤ 45 Min.)",
  prepAny: "Egal",
  ingredientsLabel: "Vorhandene Zutaten",
  ingredientsPlaceholder: "z. B. Hähnchen, Reis, Brokkoli",
  ingredientsHint:
    "Optional, durch Komma getrennt. Rezepte mit mehr Überschneidung stehen oben.",
  nutritionLabel: "Ernährungsziele",
  budgetLabel: "Budget",
  submit: "Empfehlungen anzeigen",
  submitting: "Suche Rezepte…",

  newRecommendation: "← Neue Empfehlung",
  thinking: "Denkt nach…",
  followupPlaceholder: "Anpassen, z. B. „günstiger“ oder „keine Pilze“",
  send: "Senden",
  yourRequest: "Deine Anfrage",
  chef: "Koch",

  servings: "Portionen",
  minutesShort: "Min.",
  ingredientsHeading: "Zutaten",
  shoppingListButton: "Einkaufsliste",
  shoppingListHeading: "Einkaufsliste",
  shoppingListFor: "Für",
  shoppingListAllAvailable: "Du hast bereits alles für dieses Rezept.",
  shoppingListMissing: "Noch einkaufen",
  instructionsHeading: "Zubereitung",
  viewRecipe: "Rezept ansehen",
  back: "Zurück",
  backToResults: "Zurück zu den Ergebnissen",
  recipeNotFound: "Rezept nicht gefunden",
};

const translations: Record<Lang, typeof en> = { en, de };

export type TranslationKey = keyof typeof en;

export function getT(lang: Lang) {
  return (key: TranslationKey): string => translations[lang][key];
}

export const DIET_LABELS: Record<Lang, Record<DietaryTag, string>> = {
  en: {
    vegetarian: "vegetarian",
    vegan: "vegan",
    "gluten-free": "gluten-free",
    "dairy-free": "dairy-free",
    "nut-free": "nut-free",
  },
  de: {
    vegetarian: "vegetarisch",
    vegan: "vegan",
    "gluten-free": "glutenfrei",
    "dairy-free": "laktosefrei",
    "nut-free": "nussfrei",
  },
};

export const NUTRITION_LABELS: Record<Lang, Record<NutritionTag, string>> = {
  en: {
    "high-protein": "high-protein",
    "high-fiber": "high-fiber",
    "low-carb": "low-carb",
    "low-calorie": "low-calorie",
    "low-fat": "low-fat",
  },
  de: {
    "high-protein": "proteinreich",
    "high-fiber": "ballaststoffreich",
    "low-carb": "kohlenhydratarm",
    "low-calorie": "kalorienarm",
    "low-fat": "fettarm",
  },
};

export const MEAL_LABELS: Record<Lang, Record<MealType, string>> = {
  en: { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" },
  de: { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen" },
};

export const BUDGET_LABELS: Record<Lang, Record<"low" | "medium" | "high", string>> = {
  en: { low: "Budget", medium: "Moderate", high: "Premium" },
  de: { low: "Günstig", medium: "Mittel", high: "Premium" },
};
