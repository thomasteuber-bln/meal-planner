import type { Lang, Recipe } from "@/lib/recipes";
import Link from "next/link";
import {
  BUDGET_LABELS,
  DIET_LABELS,
  MEAL_LABELS,
  NUTRITION_LABELS,
  getT,
} from "@/lib/i18n";
import { scaleIngredientLine, servingScale } from "@/lib/scaleIngredients";

function recipeSubheader(recipe: Recipe, lang: Lang): string {
  const t = getT(lang);
  const meal = MEAL_LABELS[lang][recipe.meals[0] ?? "dinner"];
  const cost = BUDGET_LABELS[lang][recipe.cost];
  return `${recipe.minutes} ${t("minutesShort")} · ${recipe.servings} ${t("servings")} · ${meal} · ${cost}`;
}

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
  const score =
    typeof recipe.spoonacularScore === "number"
      ? Math.round(recipe.spoonacularScore)
      : null;

  return (
    <article className={`recipe${recipe.imageUrl ? " recipe--with-image" : ""}`}>
      <Link
        href={`/recipes/${recipe.id}`}
        className="recipe__link"
        onClick={() => onOpenDetail?.(recipe)}
      >
        {recipe.imageUrl && (
          <div className="recipe__media">
            <img
              src={recipe.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        <div className="recipe__body">
          <h3 className="recipe__title">{recipe.title[lang]}</h3>
          <p className="recipe__subheader">{recipeSubheader(recipe, lang)}</p>

          {(recipe.tags.length > 0 || recipe.nutrition.length > 0) && (
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
          )}

          {score !== null && (
            <p className="recipe__score">
              {t("spoonacularScore")}: {score}
            </p>
          )}

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
        </div>
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
