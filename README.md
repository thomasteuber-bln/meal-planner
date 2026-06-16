# AI Chat

A minimal streaming chat app built with **Next.js (App Router) + TypeScript** and the **Vercel AI SDK v5**. Type a message and watch the assistant's reply stream in token-by-token.

## Stack

- `next` (App Router, React 19)
- `ai` (Vercel AI SDK core: `streamText`, `convertToModelMessages`)
- `@ai-sdk/react` (`useChat` hook)
- `@ai-sdk/openai` (model provider)

## Where to put your API key

1. Copy the example env file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` (in the project root) and paste your key:

   ```bash
   OPENAI_API_KEY=sk-...your key...
   ```

   - Get an OpenAI key at <https://platform.openai.com/api-keys>.
   - `.env.local` is gitignored, so the secret never gets committed.
   - The SDK reads `OPENAI_API_KEY` automatically — no extra wiring needed.
   - Restart the dev server after changing env values.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Using Anthropic instead of OpenAI

1. Install the provider:

   ```bash
   npm install @ai-sdk/anthropic
   ```

2. Put your key in `.env.local`:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-...your key...
   ```

3. Swap the model in `app/api/chat/route.ts`:

   ```ts
   import { anthropic } from "@ai-sdk/anthropic";
   // ...
   const result = streamText({
     model: anthropic("claude-3-5-sonnet-latest"),
     system: "You are a helpful, concise assistant.",
     messages: convertToModelMessages(messages),
   });
   ```

## Project layout

```
app/
  api/chat/route.ts   # POST handler: streams model output (server-only, reads API key)
  page.tsx            # Chat UI using the useChat hook
  layout.tsx          # Root layout
  globals.css         # Styles
```
