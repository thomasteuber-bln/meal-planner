export type Lang = "en" | "de";

export interface Localized {
  en: string;
  de: string;
}

export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "nut-free";

export type NutritionTag =
  | "high-protein"
  | "high-fiber"
  | "low-carb"
  | "low-calorie"
  | "low-fat";

export type MealType = "breakfast" | "lunch" | "dinner";

/** Relative cost tier; "low" is cheapest. */
export type CostTier = "low" | "medium" | "high";

export interface Recipe {
  id: string;
  title: Localized;
  description: Localized;
  minutes: number;
  servings: number;
  meals: MealType[];
  tags: DietaryTag[];
  nutrition: NutritionTag[];
  cost: CostTier;
  /** Display ingredient lines, with European (metric) measures, per language. */
  ingredients: Localized[];
  /** Lowercase keywords (both languages) used for search/filtering. */
  searchTerms: string[];
}

const COST_ORDER: Record<CostTier, number> = { low: 1, medium: 2, high: 3 };

// Hardcoded mock dataset. Amounts use metric/European measures (g, ml, °C).
const RECIPES: Recipe[] = [
  {
    id: "r1",
    title: { en: "Chickpea & Spinach Curry", de: "Kichererbsen-Spinat-Curry" },
    description: {
      en: "A cozy tomato-based curry simmered with chickpeas and spinach.",
      de: "Ein wärmendes Tomaten-Curry mit Kichererbsen und Spinat.",
    },
    minutes: 30,
    servings: 2,
    meals: ["lunch", "dinner"],
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    nutrition: ["high-fiber", "high-protein"],
    cost: "low",
    ingredients: [
      { en: "400 g chickpeas", de: "400 g Kichererbsen" },
      { en: "200 g spinach", de: "200 g Spinat" },
      { en: "250 ml coconut milk", de: "250 ml Kokosmilch" },
      { en: "400 g chopped tomatoes", de: "400 g gehackte Tomaten" },
      { en: "2 tsp curry powder", de: "2 TL Currypulver" },
    ],
    searchTerms: ["chickpeas", "kichererbsen", "spinach", "spinat", "curry", "tomato", "tomaten"],
  },
  {
    id: "r2",
    title: {
      en: "Grilled Lemon Herb Chicken",
      de: "Gegrilltes Zitronen-Kräuter-Hähnchen",
    },
    description: {
      en: "Juicy chicken breasts marinated in lemon, garlic, and herbs.",
      de: "Saftige Hähnchenbrust mariniert in Zitrone, Knoblauch und Kräutern.",
    },
    minutes: 25,
    servings: 2,
    meals: ["lunch", "dinner"],
    tags: ["gluten-free", "dairy-free", "nut-free"],
    nutrition: ["high-protein", "low-carb"],
    cost: "medium",
    ingredients: [
      { en: "2 chicken breasts (~300 g)", de: "2 Hähnchenbrustfilets (~300 g)" },
      { en: "1 lemon", de: "1 Zitrone" },
      { en: "2 garlic cloves", de: "2 Knoblauchzehen" },
      { en: "2 tbsp olive oil", de: "2 EL Olivenöl" },
      { en: "1 tsp thyme", de: "1 TL Thymian" },
    ],
    searchTerms: ["chicken", "hähnchen", "huhn", "lemon", "zitrone", "garlic", "knoblauch"],
  },
  {
    id: "r3",
    title: { en: "Quinoa Power Bowl", de: "Quinoa-Power-Bowl" },
    description: {
      en: "Protein-packed quinoa bowl with roasted veggies and tahini drizzle.",
      de: "Proteinreiche Quinoa-Bowl mit geröstetem Gemüse und Tahin.",
    },
    minutes: 35,
    servings: 2,
    meals: ["lunch", "dinner"],
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free"],
    nutrition: ["high-protein", "high-fiber"],
    cost: "low",
    ingredients: [
      { en: "150 g quinoa", de: "150 g Quinoa" },
      { en: "200 g sweet potato", de: "200 g Süßkartoffel" },
      { en: "100 g kale", de: "100 g Grünkohl" },
      { en: "200 g chickpeas", de: "200 g Kichererbsen" },
      { en: "2 tbsp tahini", de: "2 EL Tahin" },
    ],
    searchTerms: ["quinoa", "sweet potato", "süßkartoffel", "kale", "grünkohl", "chickpeas", "kichererbsen", "tahini", "tahin"],
  },
  {
    id: "r4",
    title: { en: "Creamy Mushroom Risotto", de: "Cremiges Pilzrisotto" },
    description: {
      en: "Slow-stirred arborio rice with mushrooms and parmesan.",
      de: "Langsam gerührter Risottoreis mit Pilzen und Parmesan.",
    },
    minutes: 45,
    servings: 2,
    meals: ["dinner"],
    tags: ["vegetarian", "gluten-free", "nut-free"],
    nutrition: [],
    cost: "medium",
    ingredients: [
      { en: "200 g arborio rice", de: "200 g Risottoreis" },
      { en: "250 g mushrooms", de: "250 g Champignons" },
      { en: "50 g parmesan", de: "50 g Parmesan" },
      { en: "100 ml white wine", de: "100 ml Weißwein" },
      { en: "1 onion", de: "1 Zwiebel" },
    ],
    searchTerms: ["rice", "reis", "risotto", "mushrooms", "pilze", "champignons", "parmesan", "onion", "zwiebel"],
  },
  {
    id: "r5",
    title: { en: "Almond-Crusted Salmon", de: "Lachs in Mandelkruste" },
    description: {
      en: "Oven-baked salmon with a crunchy almond crust, baked at 200 °C.",
      de: "Im Ofen gebackener Lachs mit knuspriger Mandelkruste, bei 200 °C.",
    },
    minutes: 20,
    servings: 2,
    meals: ["dinner"],
    tags: ["gluten-free", "dairy-free"],
    nutrition: ["high-protein", "low-carb"],
    cost: "high",
    ingredients: [
      { en: "2 salmon fillets (~250 g)", de: "2 Lachsfilets (~250 g)" },
      { en: "50 g almonds", de: "50 g Mandeln" },
      { en: "1 tbsp dijon mustard", de: "1 EL Dijon-Senf" },
      { en: "1 lemon", de: "1 Zitrone" },
      { en: "1 handful parsley", de: "1 Handvoll Petersilie" },
    ],
    searchTerms: ["salmon", "lachs", "almonds", "mandeln", "mustard", "senf", "lemon", "zitrone"],
  },
  {
    id: "r6",
    title: { en: "Black Bean Tacos", de: "Schwarze-Bohnen-Tacos" },
    description: {
      en: "Smoky black bean tacos with avocado and lime crema.",
      de: "Rauchige Tacos mit schwarzen Bohnen, Avocado und Limetten-Creme.",
    },
    minutes: 20,
    servings: 2,
    meals: ["lunch", "dinner"],
    tags: ["vegetarian", "nut-free"],
    nutrition: ["high-fiber", "high-protein"],
    cost: "low",
    ingredients: [
      { en: "400 g black beans", de: "400 g schwarze Bohnen" },
      { en: "6 corn tortillas", de: "6 Maistortillas" },
      { en: "1 avocado", de: "1 Avocado" },
      { en: "1 lime", de: "1 Limette" },
      { en: "1 tsp cumin", de: "1 TL Kreuzkümmel" },
    ],
    searchTerms: ["black beans", "bohnen", "beans", "tacos", "avocado", "lime", "limette", "cumin", "kreuzkümmel", "tortillas"],
  },
  {
    id: "r7",
    title: { en: "Zucchini Noodle Stir-Fry", de: "Zucchininudel-Pfanne" },
    description: {
      en: "Light, low-carb zoodles tossed with crisp veggies and ginger.",
      de: "Leichte Low-Carb-Zoodles mit knackigem Gemüse und Ingwer.",
    },
    minutes: 15,
    servings: 2,
    meals: ["lunch", "dinner"],
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    nutrition: ["low-carb", "low-calorie"],
    cost: "low",
    ingredients: [
      { en: "2 zucchini (~400 g)", de: "2 Zucchini (~400 g)" },
      { en: "1 bell pepper", de: "1 Paprika" },
      { en: "20 g ginger", de: "20 g Ingwer" },
      { en: "2 tbsp soy sauce", de: "2 EL Sojasauce" },
      { en: "1 tbsp sesame oil", de: "1 EL Sesamöl" },
    ],
    searchTerms: ["zucchini", "noodles", "nudeln", "pepper", "paprika", "ginger", "ingwer", "soy", "soja"],
  },
  {
    id: "r8",
    title: { en: "Beef & Broccoli", de: "Rind mit Brokkoli" },
    description: {
      en: "Tender beef strips and broccoli in a savory garlic sauce.",
      de: "Zarte Rindfleischstreifen und Brokkoli in würziger Knoblauchsauce.",
    },
    minutes: 25,
    servings: 2,
    meals: ["dinner"],
    tags: ["dairy-free", "nut-free"],
    nutrition: ["high-protein"],
    cost: "medium",
    ingredients: [
      { en: "300 g beef sirloin", de: "300 g Rindersteak" },
      { en: "300 g broccoli", de: "300 g Brokkoli" },
      { en: "2 garlic cloves", de: "2 Knoblauchzehen" },
      { en: "3 tbsp soy sauce", de: "3 EL Sojasauce" },
      { en: "20 g ginger", de: "20 g Ingwer" },
    ],
    searchTerms: ["beef", "rind", "rindfleisch", "broccoli", "brokkoli", "garlic", "knoblauch", "soy", "soja"],
  },
  {
    id: "r9",
    title: { en: "Veggie Scramble", de: "Gemüse-Rührei" },
    description: {
      en: "Fluffy eggs scrambled with spinach, tomato, and a little cheese.",
      de: "Lockeres Rührei mit Spinat, Tomate und etwas Käse.",
    },
    minutes: 10,
    servings: 2,
    meals: ["breakfast"],
    tags: ["vegetarian", "gluten-free", "nut-free"],
    nutrition: ["high-protein", "low-carb"],
    cost: "low",
    ingredients: [
      { en: "4 eggs", de: "4 Eier" },
      { en: "100 g spinach", de: "100 g Spinat" },
      { en: "1 tomato", de: "1 Tomate" },
      { en: "30 g cheese", de: "30 g Käse" },
      { en: "1 onion", de: "1 Zwiebel" },
    ],
    searchTerms: ["eggs", "eier", "rührei", "spinach", "spinat", "tomato", "tomate", "cheese", "käse"],
  },
  {
    id: "r10",
    title: { en: "Overnight Oats with Berries", de: "Overnight Oats mit Beeren" },
    description: {
      en: "No-cook oats soaked with chia and oat milk, topped with berries.",
      de: "Ungekochte Haferflocken mit Chia und Hafermilch, getoppt mit Beeren.",
    },
    minutes: 5,
    servings: 2,
    meals: ["breakfast"],
    tags: ["vegetarian", "vegan", "dairy-free", "nut-free"],
    nutrition: ["high-fiber"],
    cost: "low",
    ingredients: [
      { en: "100 g oats", de: "100 g Haferflocken" },
      { en: "2 tbsp chia seeds", de: "2 EL Chiasamen" },
      { en: "150 g berries", de: "150 g Beeren" },
      { en: "250 ml oat milk", de: "250 ml Hafermilch" },
      { en: "1 tbsp maple syrup", de: "1 EL Ahornsirup" },
    ],
    searchTerms: ["oats", "haferflocken", "oats", "chia", "berries", "beeren", "oat milk", "hafermilch"],
  },
  {
    id: "r11",
    title: { en: "Greek Yogurt Parfait", de: "Griechischer Joghurt-Parfait" },
    description: {
      en: "Layers of creamy yogurt, granola, and fresh fruit.",
      de: "Schichten aus cremigem Joghurt, Granola und frischem Obst.",
    },
    minutes: 5,
    servings: 2,
    meals: ["breakfast"],
    tags: ["vegetarian", "nut-free"],
    nutrition: ["high-protein"],
    cost: "low",
    ingredients: [
      { en: "300 g greek yogurt", de: "300 g griechischer Joghurt" },
      { en: "60 g granola", de: "60 g Granola" },
      { en: "1 tbsp honey", de: "1 EL Honig" },
      { en: "150 g berries", de: "150 g Beeren" },
    ],
    searchTerms: ["yogurt", "joghurt", "granola", "honey", "honig", "berries", "beeren"],
  },
  {
    id: "r12",
    title: { en: "Tofu Breakfast Burrito", de: "Tofu-Frühstücks-Burrito" },
    description: {
      en: "Scrambled tofu, black beans, and salsa wrapped in a warm tortilla.",
      de: "Rühr-Tofu, schwarze Bohnen und Salsa in einer warmen Tortilla.",
    },
    minutes: 15,
    servings: 2,
    meals: ["breakfast"],
    tags: ["vegetarian", "vegan", "dairy-free", "nut-free"],
    nutrition: ["high-protein", "high-fiber"],
    cost: "low",
    ingredients: [
      { en: "200 g tofu", de: "200 g Tofu" },
      { en: "2 tortillas", de: "2 Tortillas" },
      { en: "200 g black beans", de: "200 g schwarze Bohnen" },
      { en: "4 tbsp salsa", de: "4 EL Salsa" },
      { en: "1 avocado", de: "1 Avocado" },
    ],
    searchTerms: ["tofu", "burrito", "black beans", "bohnen", "beans", "salsa", "avocado", "tortilla"],
  },
];

export interface SearchRecipesArgs {
  query?: string;
  dietaryFilters?: DietaryTag[];
  mealType?: MealType;
  maxPrepTime?: number;
  nutrition?: NutritionTag[];
  budget?: CostTier;
  /** Preferred ingredients — used to rank, not to hard-filter. */
  preferredIngredients?: string[];
  /** Ingredients to avoid entirely. */
  excludeIngredients?: string[];
  maxResults?: number;
}

function haystack(recipe: Recipe): string {
  return [
    recipe.title.en,
    recipe.title.de,
    recipe.description.en,
    recipe.description.de,
    ...recipe.searchTerms,
    ...recipe.ingredients.flatMap((i) => [i.en, i.de]),
  ]
    .join(" ")
    .toLowerCase();
}

function matchesTerm(recipe: Recipe, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return haystack(recipe).includes(t);
}

export function searchRecipes(args: SearchRecipesArgs): Recipe[] {
  const {
    query = "",
    dietaryFilters = [],
    mealType,
    maxPrepTime,
    nutrition = [],
    budget,
    preferredIngredients = [],
    excludeIngredients = [],
    maxResults = 5,
  } = args;

  // Hard constraints that must always hold.
  const hardPool = RECIPES.filter((r) => {
    const dietOk = dietaryFilters.every((d) => r.tags.includes(d));
    const dislikeOk = !excludeIngredients.some((bad) => matchesTerm(r, bad));
    return dietOk && dislikeOk;
  });

  // Soft constraints: preferred but relaxable so we still return options.
  const satisfiesSoft = (r: Recipe) => {
    if (mealType && !r.meals.includes(mealType)) return false;
    if (typeof maxPrepTime === "number" && r.minutes > maxPrepTime) return false;
    if (nutrition.length && !nutrition.every((n) => r.nutrition.includes(n)))
      return false;
    if (budget && COST_ORDER[r.cost] > COST_ORDER[budget]) return false;
    return true;
  };

  const strict = hardPool.filter(satisfiesSoft);
  const pool = strict.length >= 3 ? strict : hardPool;

  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);

  const score = (r: Recipe) => {
    let s = 0;
    if (satisfiesSoft(r)) s += 10;
    if (mealType && r.meals.includes(mealType)) s += 3;
    s += preferredIngredients.filter((ing) => matchesTerm(r, ing)).length * 4;
    s += queryWords.filter((w) => matchesTerm(r, w)).length * 2;
    s += nutrition.filter((n) => r.nutrition.includes(n)).length;
    if (typeof maxPrepTime === "number" && r.minutes <= maxPrepTime) s += 1;
    return s;
  };

  const ranked = [...pool].sort((a, b) => score(b) - score(a) || a.minutes - b.minutes);

  const clamped = Math.min(Math.max(maxResults, 3), 5);
  return ranked.slice(0, clamped);
}
