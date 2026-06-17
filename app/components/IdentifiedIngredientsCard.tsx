"use client";

import type { Lang } from "@/lib/recipes";
import { getT } from "@/lib/i18n";

export type IdentifiedIngredientsResult = {
  count: number;
  ingredients: string[];
  error?: string;
};

export function IdentifiedIngredientsCard({
  result,
  lang,
}: {
  result: IdentifiedIngredientsResult;
  lang: Lang;
}) {
  const t = getT(lang);

  if (result.error) {
    return (
      <div className="identified-ingredients identified-ingredients--error">
        {result.error}
      </div>
    );
  }

  if (result.count === 0) {
    return (
      <div className="identified-ingredients identified-ingredients--empty">
        {t("photoScanNone")}
      </div>
    );
  }

  return (
    <div className="identified-ingredients">
      <h3 className="identified-ingredients__title">
        {t("identifiedIngredientsHeading")}
      </h3>
      <ul className="identified-ingredients__list">
        {result.ingredients.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
