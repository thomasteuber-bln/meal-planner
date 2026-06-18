"use client";

import { useState } from "react";
import type { Lang } from "@/lib/recipes";
import type {
  AllergyTag,
  DietStyle,
  MacroPercents,
  NutritionGoal,
} from "@/lib/profileOptions";
import {
  ALLERGY_OPTIONS,
  DIET_STYLE_OPTIONS,
  NUTRITION_GOAL_MACROS,
  NUTRITION_GOAL_OPTIONS,
} from "@/lib/profileOptions";
import {
  ALLERGY_LABELS,
  DIET_STYLE_LABELS,
  NUTRITION_GOAL_LABELS,
  getT,
} from "@/lib/i18n";

export interface OnboardingValues {
  diet: string[];
  allergies: string[];
  dislikes: string[];
  nutritionGoal: string | null;
  householdSize: number;
}

function MacroPercentsPreview({
  lang,
  percents,
}: {
  lang: Lang;
  percents: MacroPercents;
}) {
  const t = getT(lang);
  const rows: { key: keyof MacroPercents; label: string }[] = [
    { key: "carbs", label: t("macroCarbs") },
    { key: "protein", label: t("macroProtein") },
    { key: "fat", label: t("macroFat") },
  ];

  return (
    <div className="macro-weights" aria-live="polite">
      <p className="macro-weights__caption">{t("macroPercentOfCalories")}</p>
      {rows.map(({ key, label }) => {
        const pct = percents[key];
        return (
          <div key={key} className="macro-weights__row">
            <span className="macro-weights__label">{label}</span>
            <div className="macro-weights__track" aria-hidden>
              <span
                className="macro-weights__fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="macro-weights__pct">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingForm({
  lang,
  initial,
  saving,
  onSubmit,
}: {
  lang: Lang;
  initial?: Partial<OnboardingValues>;
  saving?: boolean;
  onSubmit: (values: OnboardingValues) => void;
}) {
  const t = getT(lang);
  const [diet, setDiet] = useState<string[]>(initial?.diet ?? []);
  const [allergies, setAllergies] = useState<string[]>(initial?.allergies ?? []);
  const [dislikes, setDislikes] = useState(initial?.dislikes?.join(", ") ?? "");
  const [nutritionGoal, setNutritionGoal] = useState<string | null>(
    initial?.nutritionGoal ?? null,
  );
  const [householdSize, setHouseholdSize] = useState(
    String(initial?.householdSize ?? 2),
  );

  function toggleDiet(value: DietStyle) {
    setDiet((prev) => (prev.includes(value) ? [] : [value]));
  }

  function toggleAllergy(value: AllergyTag) {
    setAllergies((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value],
    );
  }

  function selectNutritionGoal(value: NutritionGoal) {
    setNutritionGoal((prev) => (prev === value ? null : value));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      diet,
      allergies,
      dislikes: dislikes
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      nutritionGoal,
      householdSize: Math.max(1, parseInt(householdSize, 10) || 1),
    });
  }

  const selectedMacros = nutritionGoal
    ? NUTRITION_GOAL_MACROS[nutritionGoal as NutritionGoal]
    : null;

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <div>
        <h2 className="form__title">{t("onboardTitle")}</h2>
        <p className="form__subtitle">{t("onboardSubtitle")}</p>
      </div>

      <fieldset className="field">
        <legend className="field__label">{t("dietLabel")}</legend>
        <div className="chips">
          {DIET_STYLE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${diet.includes(option) ? "chip--on" : ""}`}
              onClick={() => toggleDiet(option)}
              aria-pressed={diet.includes(option)}
            >
              {DIET_STYLE_LABELS[lang][option]}
            </button>
          ))}
        </div>
        <span className="field__hint">{t("dietHint")}</span>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">{t("allergiesLabel")}</legend>
        <div className="chips">
          {ALLERGY_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${allergies.includes(option) ? "chip--on" : ""}`}
              onClick={() => toggleAllergy(option)}
              aria-pressed={allergies.includes(option)}
            >
              {ALLERGY_LABELS[lang][option]}
            </button>
          ))}
        </div>
        <span className="field__hint">{t("allergiesHint")}</span>
      </fieldset>

      <label className="field">
        <span className="field__label">{t("dislikesLabel")}</span>
        <input
          className="input"
          value={dislikes}
          placeholder={t("dislikesPlaceholder")}
          onChange={(e) => setDislikes(e.target.value)}
        />
        <span className="field__hint">{t("dislikesHint")}</span>
      </label>

      <fieldset className="field">
        <legend className="field__label">{t("nutritionGoalLabel")}</legend>
        <div className="chips">
          {NUTRITION_GOAL_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${nutritionGoal === option ? "chip--on" : ""}`}
              onClick={() => selectNutritionGoal(option)}
              aria-pressed={nutritionGoal === option}
            >
              {NUTRITION_GOAL_LABELS[lang][option]}
            </button>
          ))}
        </div>
        {selectedMacros && (
          <MacroPercentsPreview lang={lang} percents={selectedMacros} />
        )}
        <span className="field__hint">{t("nutritionGoalHint")}</span>
      </fieldset>

      <label className="field">
        <span className="field__label">{t("householdLabel")}</span>
        <input
          className="input input--narrow"
          type="number"
          min={1}
          value={householdSize}
          onChange={(e) => setHouseholdSize(e.target.value)}
        />
        <span className="field__hint">{t("householdHint")}</span>
      </label>

      <button className="btn btn--primary" type="submit" disabled={saving}>
        {saving ? t("saving") : t("save")}
      </button>
    </form>
  );
}
