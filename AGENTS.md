# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project overview

A **meal planner** that recommends recipes via a guided UI and an LLM agent with tools. Users complete onboarding (diet, dislikes, household size), submit a structured recipe request, and receive streamed recommendations rendered as localized recipe cards.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 15** (App Router) |
| Language | **TypeScript** (strict) |
| UI | **React 19**, CSS in `app/globals.css` |
| Agent | **Vercel AI SDK v5** (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) |
| Model | OpenAI `gpt-4o-mini` via `OPENAI_API_KEY` in `.env.local` |
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
│  lib/recipes.ts, lib/preferences.ts, lib/scaleIngredients.ts │
└─────────────────────────────────────────────────────────┘
```

### Rules

1. **Put business logic in `lib/`**, not in React components or route handlers.
2. **Tool `execute` functions** should call `lib/` functions and return plain JSON. Do not import React or UI types.
3. **The UI must not duplicate search/filter logic.** Recipe cards render structured data from the `search_recipes` tool output (`message.parts` where `type === "tool-search_recipes"`).
4. **Preferences CRUD** for the onboarding flow uses `/api/preferences` directly; the agent uses `get_preferences` / `set_preferences` tools that read/write the same `lib/preferences.ts` layer.
5. When adding features, ask: *“Would a different frontend still work if only the API contract changed?”* If not, move logic down into `lib/` or the API route.

## Agent API

| Endpoint | File | Purpose |
|----------|------|---------|
| `POST /api/chat` | `app/api/chat/route.ts` | Streaming agent (tools + model reply) |
| `GET /api/preferences` | `app/api/preferences/route.ts` | Read saved preferences (UI onboarding) |
| `POST /api/preferences` | `app/api/preferences/route.ts` | Write preferences (UI onboarding) |

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
- **Output:** `{ count, recipes }` — `recipes` is an array of `Recipe` objects from `lib/recipes.ts`
- **Implementation:** `lib/recipes.ts` → `searchRecipes()` — ranks by ingredient overlap when `availableIngredients` is set
- **Logs:** `[tool] search_recipes called with:`, returned titles

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
  api/chat/route.ts       # Agent entry point
  api/preferences/route.ts
  components/             # UI only — no agent or domain logic
  page.tsx                # Flow orchestrator (onboarding → request → results)
  globals.css
data/
  preferences.json        # Local user prefs (gitignored values in .env.local only)
lib/
  recipes.ts              # Mock recipe DB + searchRecipes() (includes steps)
  shoppingList.ts         # Missing-ingredient shopping lists
  preferences.ts          # Read/write preferences.json
  scaleIngredients.ts     # Metric amount scaling for household size
  i18n.ts                 # EN/DE UI strings and label maps
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
- **i18n:** UI strings in `lib/i18n.ts` (`getT(lang)`). Supported langs: `en`, `de`. Recipe content is localized in `lib/recipes.ts` (`Localized` `{ en, de }`).
- **Measures:** European/metric only (`g`, `ml`, `°C`, `TL`/`EL` in German). Scale display amounts via `lib/scaleIngredients.ts` using `householdSize / recipe.servings`.

### Data & secrets

- Never commit `.env.local`. Use `.env.local.example` as the template.
- `OPENAI_API_KEY` is read automatically by `@ai-sdk/openai` on the server only.
- `data/preferences.json` is committed with empty defaults; user-specific values are written at runtime.

### Scope

- Minimize diff size; match existing patterns.
- Avoid over-abstraction (no one-line helpers, no premature generalization).
- Comments only for non-obvious business rules.

## UI ↔ agent contract

The results view depends on this contract — preserve it when changing either side:

1. UI sends a structured natural-language request (built from `RecipeRequestForm` values) plus `language` in the chat body.
2. Agent calls `get_preferences`, then `search_recipes`, then streams a **short intro paragraph** (no per-recipe lists).
3. UI reads `tool-search_recipes` parts with `state === "output-available"` and renders `output.recipes` via `RecipeCard`.
4. UI reads `tool-generate_shopping_list` parts and renders via `ShoppingListCard`. Recipe cards expose a shopping-list button that sends a follow-up chat message.
5. Clicking a recipe card navigates to `/recipes/[id]` for full ingredients and step-by-step instructions (`RecipeDetail`).
6. `RecipeCard` applies household-size scaling client-side from `prefs.householdSize`; the tool returns base recipe data.

A new frontend only needs to implement the same HTTP calls and parse the same tool output shape.

## Environment

Copy and fill in:

```bash
cp .env.local.example .env.local
# OPENAI_API_KEY=sk-...
```

Restart the dev server after changing env vars.
