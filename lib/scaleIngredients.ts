/**
 * Scale numeric amounts in a localized ingredient line by `factor`
 * (typically householdSize / recipe.servings).
 */
export function scaleIngredientLine(line: string, factor: number): string {
  if (factor === 1) return line;

  return line.replace(/(\d+(?:[.,]\d+)?)/g, (match, numStr, offset) => {
    const num = parseFloat(numStr.replace(",", "."));
    const after = line.slice(offset + match.length);
    const scaled = num * factor;
    return formatAmount(scaled, after);
  });
}

function formatAmount(value: number, after: string): string {
  const rest = after.trimStart();

  if (/^(g|ml)\b/i.test(rest)) {
    if (value >= 100) return String(Math.round(value / 10) * 10);
    if (value >= 25) return String(Math.round(value / 5) * 5);
    return String(Math.round(value));
  }

  if (/^(tsp|tbsp|TL|EL)\b/i.test(rest)) {
    const rounded = Math.round(value * 2) / 2;
    return Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1).replace(/\.0$/, "");
  }

  return String(Math.max(1, Math.round(value)));
}

export function servingScale(
  recipeServings: number,
  householdSize: number | null | undefined,
): number {
  if (!householdSize || householdSize <= 0) return 1;
  return householdSize / recipeServings;
}
