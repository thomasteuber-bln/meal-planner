"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Lang, Recipe } from "@/lib/recipes";
import {
  DIET_LABELS,
  NUTRITION_LABELS,
  getT,
} from "@/lib/i18n";
import { scaleIngredientLine, servingScale } from "@/lib/scaleIngredients";

export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [householdSize, setHouseholdSize] = useState<number | null>(null);

  const t = getT(lang);
  const factor = servingScale(recipe.servings, householdSize);
  const effectiveServings = householdSize ?? recipe.servings;

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "en" || stored === "de") setLang(stored);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data: { preferences: { householdSize: number | null } }) => {
        if (active) setHouseholdSize(data.preferences?.householdSize ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function changeLang(next: Lang) {
    setLang(next);
    localStorage.setItem("lang", next);
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
      </header>

      <article className="recipe-detail">
        <button
          type="button"
          className="link recipe-detail__back"
          onClick={() => router.back()}
        >
          {t("back")}
        </button>

        <div className="recipe-detail__head">
          <h2 className="recipe-detail__title">{recipe.title[lang]}</h2>
          <span className="recipe__time">
            {recipe.minutes} {t("minutesShort")}
          </span>
        </div>

        <p className="recipe__desc">{recipe.description[lang]}</p>

        <div className="recipe__tags">
          {recipe.tags.map((tag) => (
            <span key={tag} className="tag tag--diet">
              {DIET_LABELS[lang][tag]}
            </span>
          ))}
          {recipe.nutrition.map((n) => (
            <span key={n} className="tag tag--nutrition">
              {NUTRITION_LABELS[lang][n]}
            </span>
          ))}
        </div>

        <section className="recipe-detail__section">
          <h3 className="recipe-detail__section-head">
            {t("ingredientsHeading")} · {effectiveServings} {t("servings")}
          </h3>
          <ul className="recipe-detail__list">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>{scaleIngredientLine(ing[lang], factor)}</li>
            ))}
          </ul>
        </section>

        <section className="recipe-detail__section">
          <h3 className="recipe-detail__section-head">{t("instructionsHeading")}</h3>
          <ol className="recipe-detail__steps">
            {recipe.steps.map((step, i) => (
              <li key={i}>{step[lang]}</li>
            ))}
          </ol>
        </section>
      </article>
    </main>
  );
}
