"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Lang, Recipe } from "@/lib/recipes";
import {
  DIET_LABELS,
  NUTRITION_LABELS,
  getT,
} from "@/lib/i18n";
import {
  cacheRecipeForDetail,
  getCachedRecipeFromSession,
  restoreResultsSession,
} from "@/lib/clientSession";
import { scaleIngredientLine, servingScale } from "@/lib/scaleIngredients";
import { ShoppingListCard } from "./ShoppingListCard";
import type { ShoppingListResult } from "@/lib/shoppingList";

type LoadState = "loading" | "ready" | "error";

export function RecipeDetail({ recipeId }: { recipeId: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [householdSize, setHouseholdSize] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListResult | null>(null);
  const [shoppingListBusy, setShoppingListBusy] = useState(false);
  const [shoppingListError, setShoppingListError] = useState<string | null>(null);
  const shoppingListRef = useRef<HTMLDivElement>(null);

  const t = getT(lang);

  useEffect(() => {
    const session = restoreResultsSession();
    if (session?.availableIngredients?.length) {
      setAvailableIngredients(session.availableIngredients);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "en" || stored === "de") setLang(stored);
  }, []);

  useEffect(() => {
    let active = true;

    const cached = getCachedRecipeFromSession(recipeId);
    if (cached) {
      setRecipe(cached);
      setLoadState("ready");
    }

    fetch(`/api/recipes/${recipeId}`)
      .then(async (r) => {
        const data = (await r.json()) as { recipe?: Recipe; error?: string };
        if (!r.ok) throw new Error(data.error ?? "Recipe not found");
        return data.recipe;
      })
      .then((loaded) => {
        if (!active || !loaded) return;
        setRecipe(loaded);
        cacheRecipeForDetail(loaded);
        setLoadState("ready");
      })
      .catch((error: Error) => {
        if (!active) return;
        if (cached) return;
        setErrorMessage(error.message || "Recipe not found");
        setLoadState("error");
      });

    return () => {
      active = false;
    };
  }, [recipeId]);

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

  useEffect(() => {
    if (shoppingList && shoppingListRef.current) {
      shoppingListRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [shoppingList]);

  function changeLang(next: Lang) {
    setLang(next);
    localStorage.setItem("lang", next);
  }

  async function requestShoppingList() {
    if (!recipe || shoppingListBusy) return;
    setShoppingListBusy(true);
    setShoppingListError(null);
    setShoppingList(null);

    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId: recipe.id,
          availableIngredients,
          recipe,
        }),
      });
      const data = (await res.json()) as ShoppingListResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Shopping list failed");
      setShoppingList(data);
    } catch (error) {
      setShoppingListError(
        error instanceof Error ? error.message : "Shopping list failed",
      );
    } finally {
      setShoppingListBusy(false);
    }
  }

  if (loadState === "loading" && !recipe) {
    return (
      <main className="app">
        <div className="card muted">{t("loading")}</div>
      </main>
    );
  }

  if (loadState === "error" || !recipe) {
    return (
      <main className="app">
        <div className="card muted">
          <p>{errorMessage ?? t("recipeNotFound")}</p>
          <Link className="link" href="/">
            {t("back")}
          </Link>
        </div>
      </main>
    );
  }

  const factor = servingScale(recipe.servings, householdSize);
  const effectiveServings = householdSize ?? recipe.servings;

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

      <article
        className={`recipe-detail${recipe.imageUrl ? " recipe-detail--with-image" : ""}`}
      >
        <Link href="/" className="link recipe-detail__back">
          {t("backToResults")}
        </Link>

        {recipe.imageUrl && (
          <div className="recipe-detail__media">
            <img
              src={recipe.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        <div className="recipe-detail__body">
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

          <div className="recipe-detail__footer">
            <button
              type="button"
              className="btn btn--primary recipe-detail__shopping"
              onClick={requestShoppingList}
              disabled={shoppingListBusy}
            >
              {shoppingListBusy ? t("loading") : t("shoppingListButton")}
            </button>

            {shoppingListError && (
              <p className="recipe-detail__error" role="alert">
                {shoppingListError}
              </p>
            )}

            {shoppingList && (
              <div ref={shoppingListRef}>
                <ShoppingListCard list={shoppingList} lang={lang} />
              </div>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
