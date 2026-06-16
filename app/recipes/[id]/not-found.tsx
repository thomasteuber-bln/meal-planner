"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/recipes";
import { getT } from "@/lib/i18n";

export default function RecipeNotFound() {
  const [lang, setLang] = useState<Lang>("en");
  const t = getT(lang);

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "en" || stored === "de") setLang(stored);
  }, []);

  return (
    <main className="app">
      <div className="card muted">
        <p>{t("recipeNotFound")}</p>
        <Link className="link" href="/">
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
