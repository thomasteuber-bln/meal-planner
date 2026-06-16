import type { Lang } from "@/lib/recipes";
import type { ShoppingListResult } from "@/lib/shoppingList";
import { getT } from "@/lib/i18n";

export function ShoppingListCard({
  list,
  lang,
}: {
  list: ShoppingListResult;
  lang: Lang;
}) {
  const t = getT(lang);

  return (
    <article className="shopping-list">
      <h3 className="shopping-list__title">
        {t("shoppingListHeading")} · {t("shoppingListFor")}{" "}
        {list.recipeTitle[lang]}
      </h3>
      {list.missingCount === 0 ? (
        <p className="shopping-list__empty">{t("shoppingListAllAvailable")}</p>
      ) : (
        <>
          <span className="shopping-list__head">{t("shoppingListMissing")}</span>
          <ul>
            {list.missing.map((item, i) => (
              <li key={i}>{item[lang]}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
