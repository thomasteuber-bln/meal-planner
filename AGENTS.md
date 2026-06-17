# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project overview

A **meal planner** that recommends recipes via a guided UI and an LLM agent with tools. Users complete onboarding (diet, dislikes, household size), submit a structured recipe request, and receive streamed recommendations rendered as localized recipe cards.

Recipe data comes from **Spoonacular** (English). German UI labels and recipe text are produced server-side via OpenAI.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 15** (App Router) |
| Language | **TypeScript** (strict) |
| UI | **React 19**, CSS in `app/globals.css` |
| Agent | **Vercel AI SDK v5** (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) |
| Model | OpenAI `gpt-4o-mini` via `OPENAI_API_KEY` in `.env.local` |
| Recipes | **Spoonacular** via `SPOONACULAR_API_KEY` in `.env.local` |
| Localization | OpenAI in `lib/translateRecipe.ts` (EN→DE recipe content) |
| Validation | **Zod** v4 (`inputSchema` on tools) |
| Data (local) | JSON file at `data/preferences.json` |

### Key commands

```bash
npm run dev      # http://localhost:3000
npm run build
npx tsc --noEmit
```

## Architecture: keep UI separate from agent logic

**Goal:** The frontend should be swappable (web, mobile, CLI) without rewriting the agent.

```
┌─────────────────────────────────────────────────────────┐
│  UI (replaceable)                                       │
│  app/page.tsx, app/components/*                         │
│  - forms, cards, i18n toggle                            │
│  - calls REST APIs only                                 │
└────────────────────┬────────────────────────────────────┘
                     │ POST /api/chat  (agent)
                     │ GET/POST /api/preferences  (CRUD)
                     │ GET /api/recipes/[id]  (recipe detail)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Agent route (thin orchestration)                       │
│  app/api/chat/route.ts                                  │
│  - system prompt, streamText, tool wiring               │
│  - NO business logic in execute beyond logging + lib   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Domain / agent logic (stable, UI-agnostic)             │
│  lib/recipes.ts, lib/spoonacular.ts, lib/translateRecipe.ts, │
│  lib/foodTermsEn.ts, lib/shoppingList.ts, lib/preferences.ts │
└─────────────────────────────────────────────────────────┘
```

### Rules

1. **Put business logic in `lib/`**, not in React components or route handlers.
2. **Tool `execute` functions** should call `lib/` functions and return plain JSON. Do not import React or UI types.
3. **The UI must not duplicate search/filter logic.** Recipe cards render structured data from the `search_recipes` tool output (`message.parts` where `type === "tool-search_recipes"`).
4. **Preferences CRUD** for the onboarding flow uses `/api/preferences` directly; the agent uses `get_preferences` / `set_preferences` tools that read/write the same `lib/preferences.ts` layer.
5. When adding features, ask: *“Would a different frontend still work if only the API contract changed?”* If not, move logic down into `lib/` or the API route.

## Recipe search pipeline

`searchRecipes()` in `lib/recipes.ts` orchestrates:

1. **`lib/foodTermsEn.ts`** — translate German ingredient/search terms to English (dictionary + OpenAI fallback) before calling Spoonacular.
2. **`lib/spoonacular.ts`** — lightweight candidate fetch, then bulk enrich for top results only:
   - One `complexSearch` with a **combined query** (pantry items + free-text query joined).
   - Optional **no-query retry** if the combined search returns nothing (diet/exclude filters only).
   - **Hard API filters:** diet, intolerances, `excludeIngredients` only.
   - **Soft filters** (time, budget, meal type, nutrition) are **not** sent to Spoonacular — applied locally in ranking.
   - Pool search uses `addRecipeInformation: true` but **not** `fillIngredients`, instructions, or nutrition (cheaper).
   - After ranking, top 3–5 recipes are enriched via **`/recipes/informationBulk`** (one call, not per recipe).
   - Responses log `[spoonacular] quota used today: X, left: Y` from `X-API-Quota-*` headers.
3. **Local ranking** in `lib/recipes.ts` — on the lightweight pool, before translation:
   - Fuzzy overlap with `availableIngredients` (token/substring/plural match, not exact).
   - Pantry terms expanded with English equivalents for cross-language matching.
   - Sort by **fewest missing ingredients**, then overlap ratio, then soft-filter score.
   - Soft filters for meal type / time / nutrition / budget (prefer matches, do not hard-drop the pool unless ≥3 strict matches exist).
   - **Do not hard-filter on inferred diet tags** — Spoonacular already applies diet; many API recipes omit `vegetarian`/`vegan` flags and would be dropped incorrectly.
4. **`lib/translateRecipe.ts`** — batch-translate **top results only** to German via OpenAI; cached by recipe id.
   - Search results use `{ skipSteps: true }` (title, description, ingredients only — cards do not show steps).
   - Recipe detail (`getRecipeById`) performs full translation including steps on first open.

Logs: `[spoonacular]`, `[search]`, `[translate]`, `[foodTerms]`.

### Spoonacular quota (free tier)

- **50 points/day**, resets midnight UTC. See [Spoonacular pricing](https://spoonacular.com/food-api/pricing).
- Typical **search** ≈ **4 points**: ~1.3 for pool `complexSearch` (8 results) + ~3 for `informationBulk` (5 recipes).
- Worst case (empty query + retry) ≈ **5 points** per search.
- **Recipe detail** ≈ **1 point** per `GET /recipes/{id}/information`.
- Avoid redundant searches while developing; reuse cached recipes within a dev session when possible.

## Agent API

| Endpoint | File | Purpose |
|----------|------|---------|
| `POST /api/chat` | `app/api/chat/route.ts` | Streaming agent (tools + model reply) |
| `GET /api/preferences` | `app/api/preferences/route.ts` | Read saved preferences (UI onboarding) |
| `POST /api/preferences` | `app/api/preferences/route.ts` | Write preferences (UI onboarding) |
| `GET /api/recipes/[id]` | `app/api/recipes/[id]/route.ts` | Fetch one recipe by Spoonacular id (for detail page) |

### `POST /api/chat`

**Request body:**

```json
{
  "messages": [/* UIMessage[] from @ai-sdk/react useChat */],
  "language": "en" | "de"
}
```

**Response:** UI message stream (`toUIMessageStreamResponse()`), consumed by `useChat` with `DefaultChatTransport({ api: "/api/chat" })`.

**Agent config:**

- `streamText` with `stopWhen: stepCountIs(5)` — allows tool call → follow-up reply loops.
- `maxDuration = 30` seconds.
- System prompt instructs the model to reply in the requested language and keep text brief (cards show recipe details).

## Tools

All tools are defined in `app/api/chat/route.ts`. Names use **snake_case**.

### `get_preferences`

- **Input:** none (`z.object({})`)
- **Output:** `{ preferences, missing }`
- **Implementation:** `lib/preferences.ts` → `readPreferences()`
- **Logs:** `[tool] get_preferences called`, preferences, missing keys

### `set_preferences`

- **Input (all optional):** `diet`, `dislikes`, `budget`, `householdSize`, `maxCookTime`
- **Output:** `{ saved: true, preferences, missing }`
- **Implementation:** `lib/preferences.ts` → `writePreferences(update)` (partial merge)
- **Logs:** `[tool] set_preferences called with:`, saved result

### `search_recipes`

- **Input (all optional):** `query`, `dietaryFilters`, `mealType`, `maxPrepTime`, `nutrition`, `budget`, `availableIngredients`, `excludeIngredients`, `maxResults` (3–5)
- **Output:** `{ count, recipes }` or `{ count: 0, recipes: [], error }` — `recipes` is an array of `Recipe` objects from `lib/recipes.ts`
- **Implementation:** `lib/recipes.ts` → `searchRecipes()` (see pipeline above)
- **Ranking:** fuzzy pantry overlap; fewest missing ingredients wins. `availableIngredients` are soft hints, not strict Spoonacular `includeIngredients`.
- **Logs:** `[tool] search_recipes called with:`, returned titles or error

German ingredient names in `availableIngredients` or `query` are supported; translation to English for Spoonacular is automatic.

### `generate_shopping_list`

- **Input:** `recipeId`, `availableIngredients`
- **Output:** `{ recipeId, recipeTitle, availableIngredients, missing, missingCount, overlapCount }` or `{ error }`
- **Implementation:** `lib/shoppingList.ts` → `generateShoppingList()` (scales missing lines via `lib/scaleIngredients.ts` and household size from preferences)
- **Logs:** `[tool] generate_shopping_list called with:`, missing count or error

When adding a new tool:

1. Add domain logic in `lib/`.
2. Define the tool in `app/api/chat/route.ts` with a Zod `inputSchema` and descriptive `.describe()` on fields.
3. Log calls with the `[tool] <name>` prefix.
4. Update this file and the system prompt if behavior changes.

## Directory layout

```
app/
  api/chat/route.ts         # Agent entry point
  api/preferences/route.ts
  api/recipes/[id]/route.ts # Single-recipe JSON for detail page
  components/               # UI only — no agent or domain logic
  recipes/[id]/page.tsx     # Recipe detail route
  page.tsx                  # Flow orchestrator (onboarding → request → results)
  globals.css
data/
  preferences.json          # Local user prefs (runtime values; template committed)
lib/
  recipes.ts                # Recipe types + searchRecipes() ranking
  spoonacular.ts            # Spoonacular API client + EN response mapping
  translateRecipe.ts        # OpenAI EN→DE recipe localization
  foodTermsEn.ts            # German→English food terms for Spoonacular
  clientSession.ts          # sessionStorage helpers (results restore, recipe cache)
  shoppingList.ts           # Missing-ingredient shopping lists
  preferences.ts            # Read/write preferences.json
  scaleIngredients.ts       # Metric amount scaling for household size
  i18n.ts                   # EN/DE UI strings and label maps
```

## Coding conventions

### TypeScript

- Strict mode; prefer explicit types on public `lib/` exports.
- Path alias: `@/*` maps to project root (e.g. `@/lib/recipes`).
- Use `type` imports where appropriate (`import type { … }`).

### Agent / tools

- Use `tool()` from `ai` with Zod `inputSchema` (AI SDK v5 style).
- Use `convertToModelMessages(messages)` for incoming chat history.
- Return `result.toUIMessageStreamResponse()` — do not hand-roll SSE.
- Keep system prompt changes minimal and intentional; document behavior here.

### UI

- Client components use `"use client"` only when they need hooks or browser APIs.
- Forms live in `app/components/`; `app/page.tsx` owns phase state (`onboarding` | `request` | `results`).
- Styles: plain CSS classes in `globals.css` (BEM-ish: `block__element`, modifiers with `--`).
- **i18n:** UI strings in `lib/i18n.ts` (`getT(lang)`). Supported langs: `en`, `de`. Recipe content uses `Localized { en, de }` — `en` from Spoonacular, `de` from `lib/translateRecipe.ts`.
- **Measures:** European/metric only (`g`, `ml`, `°C`, `TL`/`EL` in German). Scale display amounts via `lib/scaleIngredients.ts` using `householdSize / recipe.servings`.

### Data & secrets

- Never commit `.env.local`. Use `.env.local.example` as the template.
- `OPENAI_API_KEY` is read by `@ai-sdk/openai` and `lib/translateRecipe.ts` / `lib/foodTermsEn.ts` on the server only.
- `SPOONACULAR_API_KEY` is read only in `lib/spoonacular.ts` on the server — never expose it to the client.
- `data/preferences.json` is committed with empty defaults; user-specific values are written at runtime.

### Scope

- Minimize diff size; match existing patterns.
- Avoid over-abstraction (no one-line helpers, no premature generalization).
- Comments only for non-obvious business rules.

## UI ↔ agent contract

The results view depends on this contract — preserve it when changing either side:

1. UI sends a structured natural-language request (built from `RecipeRequestForm` values) plus `language` in the chat body.
2. Agent calls `get_preferences`, then `search_recipes`, then streams a **short intro paragraph** (no per-recipe lists).
3. UI reads `tool-search_recipes` parts with `state === "output-available"` and renders `output.recipes` via `RecipeCard`. Tool errors in `output.error` are shown inline.
4. UI reads `tool-generate_shopping_list` parts and renders via `ShoppingListCard`. Recipe cards expose a shopping-list button that sends a follow-up chat message.
5. Clicking a recipe card navigates to `/recipes/[id]` (Spoonacular numeric id). `RecipeDetail` loads from session cache + `GET /api/recipes/[id]`.
6. Results phase state (messages, available ingredients) is persisted in **sessionStorage** via `lib/clientSession.ts` so **Back to results** restores the results view after visiting a detail page.
7. `RecipeCard` applies household-size scaling client-side from `prefs.householdSize`; the tool returns base recipe data.

A new frontend only needs to implement the same HTTP calls and parse the same tool output shape.

## Environment

Copy and fill in:

```bash
cp .env.local.example .env.local
# OPENAI_API_KEY=sk-...
# SPOONACULAR_API_KEY=...
```

Restart the dev server after changing env vars. Run only **one** `npm run dev` instance; use the localhost URL printed in the terminal.

### Spoonacular setup

1. Create a free account at [spoonacular.com/food-api/console](https://spoonacular.com/food-api/console).
2. Copy the API key from the dashboard.
3. Add `SPOONACULAR_API_KEY=...` to `.env.local` (never commit this file).
4. Free tier: **50 points/day** (resets midnight UTC). See **Spoonacular quota** under Recipe search pipeline above.

### Dev troubleshooting

- If pages hang or 500, stop all dev servers, run `rm -rf .next`, then `npm run dev` once.
- If port 3000 is busy, Next.js picks another port — always open the URL from the terminal output.
