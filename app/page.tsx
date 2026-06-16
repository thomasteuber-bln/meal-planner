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
    v.preferredIngredients.length
      ? `Preferred ingredients: ${v.preferredIngredients.join(", ")}.`
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

export default function Page() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [followUp, setFollowUp] = useState("");
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
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data: { preferences: Preferences }) => {
        if (!active) return;
        setPrefs(data.preferences);
        setPhase(data.preferences?.onboarded ? "request" : "onboarding");
      })
      .catch(() => active && setPhase("onboarding"));
    return () => {
      active = false;
    };
  }, []);

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
    setMessages([]);
    setPhase("results");
    sendMessage({ text: buildRequestMessage(values) }, { body: { language: lang } });
  }

  function sendFollowUp(e: React.FormEvent) {
    e.preventDefault();
    const text = followUp.trim();
    if (!text || busy) return;
    sendMessage({ text }, { body: { language: lang } });
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
              onClick={() => setPhase("request")}
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
            const recipes = message.parts
              .filter(
                (p) =>
                  p.type === "tool-search_recipes" &&
                  "state" in p &&
                  p.state === "output-available",
              )
              .flatMap((p) => recipesFromPart(p as { output?: unknown }));

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
                    {recipes.length > 0 && (
                      <div className="recipe-grid">
                        {recipes.map((r) => (
                          <RecipeCard
                            key={r.id}
                            recipe={r}
                            lang={lang}
                            householdSize={prefs?.householdSize}
                          />
                        ))}
                      </div>
                    )}
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
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {t("send")}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
