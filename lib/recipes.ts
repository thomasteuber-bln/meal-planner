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
  /** Step-by-step preparation instructions, per language. */
  steps: Localized[];
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
    steps: [
      {
        en: "Heat a little oil in a pan. Add curry powder and stir for 30 seconds until fragrant.",
        de: "Etwas Öl in einer Pfanne erhitzen. Currypulver zugeben und 30 Sekunden anrösten.",
      },
      {
        en: "Pour in chopped tomatoes and coconut milk. Simmer gently for 5 minutes.",
        de: "Gehackte Tomaten und Kokosmilch zugeben. 5 Minuten leicht köcheln lassen.",
      },
      {
        en: "Add drained chickpeas and spinach. Cook until the spinach wilts, about 8 minutes.",
        de: "Abgetropfte Kichererbsen und Spinat zugeben. Etwa 8 Minuten garen, bis der Spinat zusammenfällt.",
      },
      {
        en: "Season with salt and serve with rice or flatbread.",
        de: "Mit Salz abschmecken und mit Reis oder Fladenbrot servieren.",
      },
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
    steps: [
      {
        en: "Mix olive oil, lemon juice, minced garlic, and thyme. Marinate the chicken for 15 minutes.",
        de: "Olivenöl, Zitronensaft, gehackten Knoblauch und Thymian mischen. Hähnchen 15 Minuten marinieren.",
      },
      {
        en: "Heat a grill pan over medium-high heat. Pat the chicken dry.",
        de: "Grillpfanne bei mittlerer bis hoher Hitze erhitzen. Hähnchen trocken tupfen.",
      },
      {
        en: "Grill the chicken 6–7 minutes per side until cooked through and lightly charred.",
        de: "Hähnchen pro Seite 6–7 Minuten grillen, bis es durch ist und leicht angebräunt.",
      },
      {
        en: "Rest 3 minutes, slice, and serve with lemon wedges.",
        de: "3 Minuten ruhen lassen, in Scheiben schneiden und mit Zitronenspalten servieren.",
      },
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
    steps: [
      {
        en: "Rinse quinoa and cook in salted water according to package directions, about 15 minutes.",
        de: "Quinoa abspülen und in Salzwasser nach Packungsanweisung etwa 15 Minuten kochen.",
      },
      {
        en: "Dice sweet potato and roast at 200 °C with a little oil for 20 minutes until tender.",
        de: "Süßkartoffel würfeln und mit etwas Öl 20 Minuten bei 200 °C rösten, bis sie weich ist.",
      },
      {
        en: "Massage kale with a pinch of salt until softened. Drain and rinse chickpeas.",
        de: "Grünkohl mit einer Prise Salz massieren, bis er weicher wird. Kichererbsen abtropfen und abspülen.",
      },
      {
        en: "Divide quinoa among bowls. Top with sweet potato, kale, and chickpeas. Drizzle with tahini.",
        de: "Quinoa auf Schalen verteilen. Mit Süßkartoffel, Grünkohl und Kichererbsen belegen. Mit Tahin beträufeln.",
      },
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
    steps: [
      {
        en: "Warm stock in a separate pot. Sauté diced onion in butter until soft, about 5 minutes.",
        de: "Brühe in einem Topf erwärmen. Gewürfelte Zwiebel in Butter etwa 5 Minuten anschwitzen.",
      },
      {
        en: "Add sliced mushrooms and rice. Stir until the rice looks slightly translucent.",
        de: "Pilze in Scheiben und Reis zugeben. Rühren, bis der Reis leicht glasig wird.",
      },
      {
        en: "Pour in wine and stir until absorbed. Add stock one ladle at a time, stirring constantly, about 25 minutes.",
        de: "Wein zugießen und einrühren, bis er aufgenommen ist. Brühe schöpfweise zugeben und ständig rühren, etwa 25 Minuten.",
      },
      {
        en: "Fold in grated parmesan, season, and serve immediately.",
        de: "Geriebenen Parmesan unterheben, abschmecken und sofort servieren.",
      },
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
    steps: [
      {
        en: "Preheat the oven to 200 °C. Line a baking tray with parchment.",
        de: "Ofen auf 200 °C vorheizen. Backblech mit Backpapier auslegen.",
      },
      {
        en: "Chop almonds finely. Mix with mustard and spread on top of the salmon fillets.",
        de: "Mandeln fein hacken. Mit Senf mischen und auf die Lachsfilets streichen.",
      },
      {
        en: "Bake 12–14 minutes until the salmon flakes easily and the crust is golden.",
        de: "12–14 Minuten backen, bis der Lachs sich leicht teilen lässt und die Kruste goldbraun ist.",
      },
      {
        en: "Squeeze over lemon juice, garnish with parsley, and serve.",
        de: "Mit Zitronensaft beträufeln, mit Petersilie garnieren und servieren.",
      },
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
    steps: [
      {
        en: "Warm a pan over medium heat. Add drained black beans with cumin and a splash of water. Simmer 5 minutes.",
        de: "Pfanne bei mittlerer Hitze erhitzen. Abgetropfte schwarze Bohnen mit Kreuzkümmel und etwas Wasser 5 Minuten köcheln.",
      },
      {
        en: "Mash half the beans lightly to make a creamy filling. Season with salt.",
        de: "Die Hälfte der Bohnen leicht zerdrücken, für eine cremige Füllung. Mit Salz würzen.",
      },
      {
        en: "Warm tortillas in a dry pan for 30 seconds per side.",
        de: "Tortillas in einer trockenen Pfanne pro Seite 30 Sekunden erwärmen.",
      },
      {
        en: "Fill tortillas with beans, sliced avocado, and a squeeze of lime. Fold and serve.",
        de: "Tortillas mit Bohnen, Avocadoscheiben und Limettensaft füllen. Falten und servieren.",
      },
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
    steps: [
      {
        en: "Spiralize or julienne the zucchini into noodles. Pat dry with a towel.",
        de: "Zucchini mit einem Spiralschneider oder Messer in Nudeln schneiden. Mit einem Tuch trocken tupfen.",
      },
      {
        en: "Heat sesame oil in a wok. Stir-fry sliced bell pepper and grated ginger for 2 minutes.",
        de: "Sesamöl im Wok erhitzen. Paprikastreifen und geriebenen Ingwer 2 Minuten anbraten.",
      },
      {
        en: "Add zucchini noodles and soy sauce. Toss over high heat for 3–4 minutes until just tender.",
        de: "Zucchininudeln und Sojasauce zugeben. Bei starker Hitze 3–4 Minuten schwenken, bis sie gerade weich sind.",
      },
      {
        en: "Serve immediately while the noodles still have a little bite.",
        de: "Sofort servieren, solange die Nudeln noch leicht Biss haben.",
      },
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
    steps: [
      {
        en: "Slice beef thinly against the grain. Cut broccoli into small florets.",
        de: "Rindfleisch quer zur Faser in dünne Scheiben schneiden. Brokkoli in kleine Röschen teilen.",
      },
      {
        en: "Heat oil in a wok over high heat. Stir-fry beef in batches until browned, 2–3 minutes. Set aside.",
        de: "Öl im Wok bei starker Hitze erhitzen. Rindfleisch portionsweise 2–3 Minuten anbraten. Beiseite stellen.",
      },
      {
        en: "Stir-fry broccoli with garlic and ginger for 3 minutes. Return beef to the pan.",
        de: "Brokkoli mit Knoblauch und Ingwer 3 Minuten anbraten. Rindfleisch zurück in die Pfanne geben.",
      },
      {
        en: "Add soy sauce and a splash of water. Toss 1 minute until glossy. Serve with rice.",
        de: "Sojasauce und etwas Wasser zugeben. 1 Minute schwenken, bis alles glänzt. Mit Reis servieren.",
      },
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
    steps: [
      {
        en: "Dice onion and tomato. Wilt spinach in a dry pan for 1 minute, then squeeze out excess water.",
        de: "Zwiebel und Tomate würfeln. Spinat 1 Minute in einer trockenen Pfanne zusammenfallen lassen und ausdrücken.",
      },
      {
        en: "Beat eggs with a pinch of salt. Melt a little butter in a non-stick pan over medium heat.",
        de: "Eier mit einer Prise Salz verquirlen. Etwas Butter in einer beschichteten Pfanne bei mittlerer Hitze schmelzen.",
      },
      {
        en: "Sauté onion 2 minutes, add tomato and spinach, then pour in eggs.",
        de: "Zwiebel 2 Minuten anbraten, Tomate und Spinat zugeben, dann Eier hineingießen.",
      },
      {
        en: "Stir gently until softly set. Sprinkle with cheese and serve warm.",
        de: "Sanft rühren, bis die Masse weich gestockt ist. Mit Käse bestreuen und warm servieren.",
      },
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
    steps: [
      {
        en: "Combine oats, chia seeds, oat milk, and maple syrup in a jar or bowl.",
        de: "Haferflocken, Chiasamen, Hafermilch und Ahornsirup in einem Glas oder einer Schüssel vermischen.",
      },
      {
        en: "Stir well, cover, and refrigerate overnight (or at least 4 hours).",
        de: "Gut umrühren, abdecken und über Nacht (oder mindestens 4 Stunden) kühlen.",
      },
      {
        en: "In the morning, stir again and add a splash of milk if too thick.",
        de: "Am Morgen erneut umrühren und bei Bedarf etwas Milch zugeben, falls es zu dick ist.",
      },
      {
        en: "Top with berries and serve chilled.",
        de: "Mit Beeren toppen und kalt servieren.",
      },
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
    steps: [
      {
        en: "Spoon half the yogurt into two glasses as the first layer.",
        de: "Die Hälfte des Joghurts als erste Schicht auf zwei Gläser verteilen.",
      },
      {
        en: "Add a layer of granola and drizzle with honey.",
        de: "Eine Schicht Granola darauf geben und mit Honig beträufeln.",
      },
      {
        en: "Top with remaining yogurt, then finish with berries.",
        de: "Mit restlichem Joghurt bedecken und mit Beeren abschließen.",
      },
      {
        en: "Serve immediately or chill up to 2 hours before serving.",
        de: "Sofort servieren oder bis zu 2 Stunden kühlen.",
      },
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
    steps: [
      {
        en: "Crumble tofu and sauté in a little oil with a pinch of turmeric and salt for 5 minutes.",
        de: "Tofu zerbröseln und mit einer Prise Kurkuma und Salz in etwas Öl 5 Minuten anbraten.",
      },
      {
        en: "Warm black beans in a small pan. Heat tortillas in a dry pan.",
        de: "Schwarze Bohnen in einer kleinen Pfanne erwärmen. Tortillas in einer trockenen Pfanne erhitzen.",
      },
      {
        en: "Fill each tortilla with tofu, beans, salsa, and sliced avocado.",
        de: "Jede Tortilla mit Tofu, Bohnen, Salsa und Avocadoscheiben füllen.",
      },
      {
        en: "Roll up tightly and serve warm.",
        de: "Fest einrollen und warm servieren.",
      },
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
  /** Ingredients the user already has — used to rank by overlap, not to hard-filter. */
  availableIngredients?: string[];
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

export function ingredientLineMatchesTerm(line: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  return line.toLowerCase().includes(t);
}

/** How many recipe ingredient lines match at least one available ingredient. */
export function countIngredientOverlap(
  recipe: Recipe,
  availableIngredients: string[],
): number {
  if (!availableIngredients.length) return 0;
  return recipe.ingredients.filter((ing) =>
    availableIngredients.some(
      (a) =>
        ingredientLineMatchesTerm(ing.en, a) ||
        ingredientLineMatchesTerm(ing.de, a),
    ),
  ).length;
}

export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function searchRecipes(args: SearchRecipesArgs): Recipe[] {
  const {
    query = "",
    dietaryFilters = [],
    mealType,
    maxPrepTime,
    nutrition = [],
    budget,
    availableIngredients = [],
    excludeIngredients = [],
    maxResults = 5,
  } = args;

  // Hard constraints that must always hold.
  const hardPool = RECIPES.filter((r) => {
    const dietOk = dietaryFilters.every((d) => r.tags.includes(d));
    const dislikeOk = !excludeIngredients.some((bad) => matchesTerm(r, bad));
    return dietOk && dislikeOk;
  });

  // Soft constraints: relaxable so we still return options when filters are tight.
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
    s += queryWords.filter((w) => matchesTerm(r, w)).length * 2;
    s += nutrition.filter((n) => r.nutrition.includes(n)).length;
    if (typeof maxPrepTime === "number" && r.minutes <= maxPrepTime) s += 1;
    return s;
  };

  const ranked = [...pool].sort((a, b) => {
    if (availableIngredients.length > 0) {
      const overlapA = countIngredientOverlap(a, availableIngredients);
      const overlapB = countIngredientOverlap(b, availableIngredients);
      if (overlapB !== overlapA) return overlapB - overlapA;
      const ratioA = overlapA / a.ingredients.length;
      const ratioB = overlapB / b.ingredients.length;
      if (ratioB !== ratioA) return ratioB - ratioA;
    }
    return score(b) - score(a) || a.minutes - b.minutes;
  });

  const clamped = Math.min(Math.max(maxResults, 3), 5);
  return ranked.slice(0, clamped);
}
