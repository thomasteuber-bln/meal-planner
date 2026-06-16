"use client";

import { useState } from "react";
import type { Lang, MealType, NutritionTag } from "@/lib/recipes";
import {
  BUDGET_LABELS,
  MEAL_LABELS,
  NUTRITION_LABELS,
  getT,
} from "@/lib/i18n";

const MEAL_OPTIONS: MealType[] = ["breakfast", "lunch", "dinner"];

const NUTRITION_OPTIONS: NutritionTag[] = [
  "high-protein",
  "high-fiber",
  "low-carb",
  "low-calorie",
  "low-fat",
];

const BUDGET_OPTIONS = ["low", "medium", "high"] as const;

export type BudgetTier = (typeof BUDGET_OPTIONS)[number];

export interface RecipeRequestValues {
  mealType: MealType;
  maxPrepTime: number; // 0 = any
  availableIngredients: string[];
  nutrition: string[];
  budget: BudgetTier;
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
  const [nutrition, setNutrition] = useState<string[]>([]);
  const [budget, setBudget] = useState<BudgetTier>("medium");

  const prepOptions = [
    { label: t("prepQuick"), value: 15 },
    { label: t("prepMedium"), value: 30 },
    { label: t("prepRelaxed"), value: 45 },
    { label: t("prepAny"), value: 0 },
  ];

  function toggleNutrition(value: string) {
    setNutrition((prev) =>
      prev.includes(value) ? prev.filter((n) => n !== value) : [...prev, value],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      mealType,
      maxPrepTime,
      availableIngredients: ingredients
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean),
      nutrition,
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
        <span className="field__hint">{t("ingredientsHint")}</span>
      </label>

      <fieldset className="field">
        <legend className="field__label">{t("nutritionLabel")}</legend>
        <div className="chips">
          {NUTRITION_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${nutrition.includes(option) ? "chip--on" : ""}`}
              onClick={() => toggleNutrition(option)}
              aria-pressed={nutrition.includes(option)}
            >
              {NUTRITION_LABELS[lang][option]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">{t("budgetLabel")}</legend>
        <div className="segmented">
          {BUDGET_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`segmented__item ${budget === option ? "segmented__item--on" : ""}`}
              onClick={() => setBudget(option)}
              aria-pressed={budget === option}
            >
              {BUDGET_LABELS[lang][option]}
            </button>
          ))}
        </div>
      </fieldset>

      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
