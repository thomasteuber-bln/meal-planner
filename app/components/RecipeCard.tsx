import type { Lang, Recipe } from "@/lib/recipes";
import Link from "next/link";
import {
  DIET_LABELS,
  NUTRITION_LABELS,
  getT,
} from "@/lib/i18n";
import { scaleIngredientLine, servingScale } from "@/lib/scaleIngredients";

export function RecipeCard({
  recipe,
  lang,
  householdSize,
  onShoppingList,
  shoppingListBusy,
  onOpenDetail,
}: {
  recipe: Recipe;
  lang: Lang;
  householdSize?: number | null;
  onShoppingList?: (recipeId: string) => void;
  shoppingListBusy?: boolean;
  onOpenDetail?: (recipe: Recipe) => void;
}) {
  const t = getT(lang);
  const factor = servingScale(recipe.servings, householdSize);
  const effectiveServings = householdSize ?? recipe.servings;

  return (
    <article className="recipe">
      <Link
        href={`/recipes/${recipe.id}`}
        className="recipe__link"
        onClick={() => onOpenDetail?.(recipe)}
      >
        <div className="recipe__head">
          <h3 className="recipe__title">{recipe.title[lang]}</h3>
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

        <div className="recipe__ingredients">
          <span className="recipe__ingredients-head">
            {t("ingredientsHeading")} · {effectiveServings} {t("servings")}
          </span>
          <ul>
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>{scaleIngredientLine(ing[lang], factor)}</li>
            ))}
          </ul>
        </div>

        <span className="recipe__cta">{t("viewRecipe")} →</span>
      </Link>

      {onShoppingList && (
        <button
          type="button"
          className="btn recipe__shopping"
          onClick={() => onShoppingList(recipe.id)}
          disabled={shoppingListBusy}
        >
          {t("shoppingListButton")}
        </button>
      )}
    </article>
  );
}
