"use client";

import { useState } from "react";
import type { Lang, MealType } from "@/lib/recipes";
import type { CuisinePreference } from "@/lib/profileOptions";
import { CUISINE_OPTIONS } from "@/lib/profileOptions";
import { BUDGET_LABELS, CUISINE_LABELS, MEAL_LABELS, getT } from "@/lib/i18n";
import { IngredientPhotoScan } from "./IngredientPhotoScan";

const MEAL_OPTIONS: MealType[] = ["breakfast", "lunch", "dinner"];

const BUDGET_OPTIONS = ["low", "medium", "high"] as const;

export type BudgetTier = (typeof BUDGET_OPTIONS)[number];

export interface RecipeRequestValues {
  mealType: MealType;
  maxPrepTime: number; // 0 = any
  availableIngredients: string[];
  cuisinePreferences: string[];
  budget: BudgetTier | null;
}

export function RecipeRequestForm({
  lang,
  busy,
  onSubmit,
  onEditPreferences,
}: {
  lang: Lang;
  busy?: boolean;
  onSubmit: (values: RecipeRequestValues) => void;
  onEditPreferences: () => void;
}) {
  const t = getT(lang);
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [maxPrepTime, setMaxPrepTime] = useState<number>(30);
  const [ingredients, setIngredients] = useState("");
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([]);
  const [budget, setBudget] = useState<BudgetTier | null>(null);

  const prepOptions = [
    { label: t("prepQuick"), value: 15 },
    { label: t("prepMedium"), value: 30 },
    { label: t("prepRelaxed"), value: 45 },
    { label: t("prepAny"), value: 0 },
  ];

  function toggleCuisine(value: CuisinePreference) {
    setCuisinePreferences((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  const budgetOptions: { label: string; value: BudgetTier | null }[] = [
    { label: t("budgetAny"), value: null },
    ...BUDGET_OPTIONS.map((option) => ({
      label: BUDGET_LABELS[lang][option],
      value: option,
    })),
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      mealType,
      maxPrepTime,
      availableIngredients: ingredients
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean),
      cuisinePreferences,
      budget,
    });
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <div className="form__head">
        <div>
          <h2 className="form__title">{t("requestTitle")}</h2>
          <p className="form__subtitle">{t("requestSubtitle")}</p>
        </div>
        <button type="button" className="link" onClick={onEditPreferences}>
          {t("editPreferences")}
        </button>
      </div>

      <fieldset className="field">
        <legend className="field__label">{t("mealLabel")}</legend>
        <div className="segmented">
          {MEAL_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`segmented__item ${mealType === option ? "segmented__item--on" : ""}`}
              onClick={() => setMealType(option)}
              aria-pressed={mealType === option}
            >
              {MEAL_LABELS[lang][option]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">{t("cuisineLabel")}</legend>
        <div className="chips">
          {CUISINE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${cuisinePreferences.includes(option) ? "chip--on" : ""}`}
              onClick={() => toggleCuisine(option)}
              aria-pressed={cuisinePreferences.includes(option)}
            >
              {CUISINE_LABELS[lang][option]}
            </button>
          ))}
        </div>
        <span className="field__hint">{t("cuisineHint")}</span>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">{t("prepLabel")}</legend>
        <div className="chips">
          {prepOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`chip ${maxPrepTime === option.value ? "chip--on" : ""}`}
              onClick={() => setMaxPrepTime(option.value)}
              aria-pressed={maxPrepTime === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span className="field__label">{t("ingredientsLabel")}</span>
        <input
          className="input"
          value={ingredients}
          placeholder={t("ingredientsPlaceholder")}
          onChange={(e) => setIngredients(e.target.value)}
        />
        <IngredientPhotoScan
          lang={lang}
          ingredients={ingredients}
          onIngredientsChange={setIngredients}
          disabled={busy}
        />
        <span className="field__hint">{t("ingredientsHint")}</span>
      </label>

      <fieldset className="field">
        <legend className="field__label">{t("budgetLabel")}</legend>
        <div className="chips">
          {budgetOptions.map((option) => (
            <button
              type="button"
              key={option.label}
              className={`chip ${budget === option.value ? "chip--on" : ""}`}
              onClick={() => setBudget(option.value)}
              aria-pressed={budget === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="field__hint">{t("budgetHint")}</span>
      </fieldset>

      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
