import { notFound } from "next/navigation";
import { getRecipeById } from "@/lib/recipes";
import { RecipeDetail } from "@/app/components/RecipeDetail";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = getRecipeById(id);
  if (!recipe) notFound();
  return <RecipeDetail recipe={recipe} />;
}
