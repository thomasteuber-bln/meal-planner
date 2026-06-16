import { RecipeDetail } from "@/app/components/RecipeDetail";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecipeDetail recipeId={id} />;
}
