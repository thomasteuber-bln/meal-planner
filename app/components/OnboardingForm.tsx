"use client";

import { useState } from "react";
import type { DietaryTag, Lang } from "@/lib/recipes";
import { DIET_LABELS, getT } from "@/lib/i18n";

const DIET_OPTIONS: DietaryTag[] = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
];

export interface OnboardingValues {
  diet: string[];
  dislikes: string[];
  householdSize: number;
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
  const [dislikes, setDislikes] = useState(initial?.dislikes?.join(", ") ?? "");
  const [householdSize, setHouseholdSize] = useState(
    String(initial?.householdSize ?? 2),
  );

  function toggleDiet(value: string) {
    setDiet((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      diet,
      dislikes: dislikes
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      householdSize: Math.max(1, parseInt(householdSize, 10) || 1),
    });
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <div>
        <h2 className="form__title">{t("onboardTitle")}</h2>
        <p className="form__subtitle">{t("onboardSubtitle")}</p>
      </div>

      <fieldset className="field">
        <legend className="field__label">{t("dietLabel")}</legend>
        <div className="chips">
          {DIET_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${diet.includes(option) ? "chip--on" : ""}`}
              onClick={() => toggleDiet(option)}
              aria-pressed={diet.includes(option)}
            >
              {DIET_LABELS[lang][option]}
            </button>
          ))}
        </div>
        <span className="field__hint">{t("dietHint")}</span>
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
