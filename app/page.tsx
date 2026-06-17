"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
import type { Lang, Recipe } from "@/lib/recipes";
import { getT } from "@/lib/i18n";
import {
  OnboardingForm,
  type OnboardingValues,
} from "./components/OnboardingForm";
import {
  RecipeRequestForm,
  type RecipeRequestValues,
} from "./components/RecipeRequestForm";
import { RecipeCard } from "./components/RecipeCard";
import { ShoppingListCard } from "./components/ShoppingListCard";
import {
  IdentifiedIngredientsCard,
  type IdentifiedIngredientsResult,
} from "./components/IdentifiedIngredientsCard";
import type { ShoppingListResult } from "@/lib/shoppingList";
import {
  cacheRecipeForDetail,
  clearResultsSession,
  persistResultsSession,
  restoreResultsSession,
} from "@/lib/clientSession";
import type { UIMessage } from "ai";

type Phase = "loading" | "onboarding" | "request" | "results";

interface Preferences {
  diet: string[] | null;
  dislikes: string[] | null;
  householdSize: number | null;
  onboarded: boolean;
}

function buildRequestMessage(v: RecipeRequestValues): string {
  const parts = [
    `Please recommend recipes for ${v.mealType}.`,
    v.maxPrepTime
      ? `Maximum preparation time: ${v.maxPrepTime} minutes.`
      : "Preparation time: no limit.",
    v.availableIngredients.length
      ? `Available ingredients: ${v.availableIngredients.join(", ")}.`
      : null,
    v.nutrition.length ? `Nutritional goals: ${v.nutrition.join(", ")}.` : null,
    `Budget: ${v.budget}.`,
    "Apply my saved diet and dislikes from my preferences.",
  ].filter(Boolean);
  return parts.join(" ");
}

function recipesFromPart(part: { output?: unknown }): Recipe[] {
  const output = part.output as { recipes?: Recipe[] } | undefined;
  return output?.recipes ?? [];
}

function searchErrorFromPart(part: { output?: unknown }): string | null {
  const output = part.output as { error?: string } | undefined;
  return output?.error ?? null;
}

function shoppingListFromPart(part: { output?: unknown }): ShoppingListResult | null {
  const output = part.output;
  if (!output || typeof output !== "object") return null;
  if ("error" in output) return null;
  if (!("recipeId" in output) || !("missing" in output)) return null;
  return output as ShoppingListResult;
}

function identifiedIngredientsFromPart(part: {
  output?: unknown;
}): IdentifiedIngredientsResult | null {
  const output = part.output;
  if (!output || typeof output !== "object") return null;
  if (!("ingredients" in output)) return null;
  return output as IdentifiedIngredientsResult;
}

export default function Page() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [followUpFile, setFollowUpFile] = useState<File | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [lang, setLang] = useState<Lang>("en");

  const t = getT(lang);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "en" || stored === "de") setLang(stored);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      if (active) setPhase("onboarding");
    }, 10_000);

    fetch("/api/preferences", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`preferences ${r.status}`);
        return r.json();
      })
      .then((data: { preferences: Preferences }) => {
        if (!active) return;
        window.clearTimeout(timeout);
        setPrefs(data.preferences);

        const restored = restoreResultsSession();
        if (restored?.messages?.length) {
          setMessages(restored.messages as UIMessage[]);
          setAvailableIngredients(restored.availableIngredients ?? []);
          if (restored.lang === "en" || restored.lang === "de") {
            setLang(restored.lang);
          }
          setPhase("results");
          return;
        }

        setPhase(data.preferences?.onboarded ? "request" : "onboarding");
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setPhase("onboarding");
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (phase !== "results" || messages.length === 0) return;
    persistResultsSession({ messages, availableIngredients, lang });
  }, [phase, messages, availableIngredients, lang]);

  function changeLang(next: Lang) {
    setLang(next);
    localStorage.setItem("lang", next);
  }

  async function saveOnboarding(values: OnboardingValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, onboarded: true }),
      });
      const data = await res.json();
      setPrefs(data.preferences);
      setPhase("request");
    } finally {
      setSaving(false);
    }
  }

  function submitRequest(values: RecipeRequestValues) {
    clearResultsSession();
    setMessages([]);
    setAvailableIngredients(values.availableIngredients);
    setPhase("results");
    sendMessage({ text: buildRequestMessage(values) }, { body: { language: lang } });
  }

  function requestShoppingList(recipeId: string) {
    const avail = availableIngredients.length
      ? `My available ingredients: ${availableIngredients.join(", ")}.`
      : "I did not specify available ingredients.";
    sendMessage(
      { text: `Generate a shopping list for recipe ${recipeId}. ${avail}` },
      { body: { language: lang } },
    );
  }

  function openRecipeDetail(recipe: Recipe) {
    cacheRecipeForDetail(recipe);
    persistResultsSession({ messages, availableIngredients, lang });
  }

  function sendFollowUp(e: React.FormEvent) {
    e.preventDefault();
    const text = followUp.trim();
    if ((!text && !followUpFile) || busy) return;

    if (followUpFile) {
      const prompt =
        text ||
        (lang === "de"
          ? "Identifiziere die Zutat in diesem Foto."
          : "Identify the ingredients in this photo.");
      const transfer = new DataTransfer();
      transfer.items.add(followUpFile);
      sendMessage(
        { text: prompt, files: transfer.files },
        { body: { language: lang } },
      );
      setFollowUpFile(null);
    } else {
      sendMessage({ text }, { body: { language: lang } });
    }

    setFollowUp("");
  }

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__heading">
          <h1>{t("appTitle")}</h1>
          <div className="langtoggle" role="group" aria-label="Language">
            <button
              className={`langtoggle__btn ${lang === "en" ? "langtoggle__btn--on" : ""}`}
              onClick={() => changeLang("en")}
              type="button"
            >
              EN
            </button>
            <button
              className={`langtoggle__btn ${lang === "de" ? "langtoggle__btn--on" : ""}`}
              onClick={() => changeLang("de")}
              type="button"
            >
              DE
            </button>
          </div>
        </div>
        {prefs?.onboarded && (
          <p className="app__sub">
            {[
              prefs.diet?.length ? prefs.diet.join(", ") : t("noDietLimits"),
              prefs.dislikes?.length
                ? `${t("avoiding")} ${prefs.dislikes.join(", ")}`
                : null,
              prefs.householdSize
                ? `${t("forPeople")} ${prefs.householdSize}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </header>

      {phase === "loading" && <div className="card muted">{t("loading")}</div>}

      {phase === "onboarding" && (
        <OnboardingForm
          lang={lang}
          initial={{
            diet: prefs?.diet ?? [],
            dislikes: prefs?.dislikes ?? [],
            householdSize: prefs?.householdSize ?? 2,
          }}
          saving={saving}
          onSubmit={saveOnboarding}
        />
      )}

      {phase === "request" && (
        <RecipeRequestForm
          lang={lang}
          busy={busy}
          onSubmit={submitRequest}
          onEditPreferences={() => setPhase("onboarding")}
        />
      )}

      {phase === "results" && (
        <section className="results">
          <div className="results__bar">
            <button
              className="btn"
              type="button"
              onClick={() => {
                clearResultsSession();
                setPhase("request");
              }}
              disabled={busy}
            >
              {t("newRecommendation")}
            </button>
          </div>

          {messages.map((message) => {
            const text = message.parts
              .filter((p) => p.type === "text")
              .map((p) => ("text" in p ? p.text : ""))
              .join("");
            const searchErrors = message.parts
              .filter(
                (p) =>
                  p.type === "tool-search_recipes" &&
                  "state" in p &&
                  p.state === "output-available",
              )
              .map((p) => searchErrorFromPart(p as { output?: unknown }))
              .filter((err): err is string => Boolean(err));
            const recipes = message.parts
              .filter(
                (p) =>
                  p.type === "tool-search_recipes" &&
                  "state" in p &&
                  p.state === "output-available",
              )
              .flatMap((p) => recipesFromPart(p as { output?: unknown }));
            const shoppingLists = message.parts
              .filter(
                (p) =>
                  p.type === "tool-generate_shopping_list" &&
                  "state" in p &&
                  p.state === "output-available",
              )
              .map((p) => shoppingListFromPart(p as { output?: unknown }))
              .filter((list): list is ShoppingListResult => list !== null);
            const identifiedLists = message.parts
              .filter(
                (p) =>
                  p.type === "tool-identify_ingredients_from_image" &&
                  "state" in p &&
                  p.state === "output-available",
              )
              .map((p) => identifiedIngredientsFromPart(p as { output?: unknown }))
              .filter((list): list is IdentifiedIngredientsResult => list !== null);

            return (
              <div key={message.id} className={`block block--${message.role}`}>
                {message.role === "user" ? (
                  <div className="bubble bubble--user">
                    <span className="bubble__role">{t("yourRequest")}</span>
                    <div className="bubble__text">{text}</div>
                  </div>
                ) : (
                  <>
                    {text && (
                      <div className="bubble bubble--assistant">
                        <span className="bubble__role">{t("chef")}</span>
                        <div className="bubble__text">{text}</div>
                      </div>
                    )}
                    {searchErrors.map((err) => (
                      <div key={err} className="bubble bubble--assistant bubble--error">
                        {err}
                      </div>
                    ))}
                    {recipes.length > 0 && (
                      <div className="recipe-grid">
                        {recipes.map((r) => (
                          <RecipeCard
                            key={r.id}
                            recipe={r}
                            lang={lang}
                            householdSize={prefs?.householdSize}
                            onShoppingList={requestShoppingList}
                            shoppingListBusy={busy}
                            onOpenDetail={openRecipeDetail}
                          />
                        ))}
                      </div>
                    )}
                    {shoppingLists.map((list) => (
                      <ShoppingListCard key={list.recipeId} list={list} lang={lang} />
                    ))}
                    {identifiedLists.map((list, i) => (
                      <IdentifiedIngredientsCard
                        key={`identified-${i}-${list.ingredients.join("-")}`}
                        result={list}
                        lang={lang}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}

          {busy && <div className="muted">{t("thinking")}</div>}

          <form className="followup" onSubmit={sendFollowUp}>
            <input
              className="input"
              value={followUp}
              placeholder={t("followupPlaceholder")}
              onChange={(e) => setFollowUp(e.target.value)}
              disabled={busy}
            />
            <label className="followup__attach">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                capture="environment"
                className="photo-scan__input"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  setFollowUpFile(file);
                }}
              />
              {t("photoScanButton")}
            </label>
            {followUpFile && (
              <span className="followup__file">{followUpFile.name}</span>
            )}
            <button
              className="btn btn--primary"
              type="submit"
              disabled={busy || (!followUp.trim() && !followUpFile)}
            >
              {t("send")}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
