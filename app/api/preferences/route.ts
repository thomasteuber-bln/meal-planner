import { readPreferences, writePreferences } from "@/lib/preferences";

export async function GET() {
  const result = await readPreferences();
  return Response.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();

  const update: Record<string, unknown> = {};
  if (Array.isArray(body.diet)) update.diet = body.diet;
  if (Array.isArray(body.allergies)) update.allergies = body.allergies;
  if (Array.isArray(body.dislikes)) update.dislikes = body.dislikes;
  if (typeof body.nutritionGoal === "string" || body.nutritionGoal === null) {
    update.nutritionGoal = body.nutritionGoal;
  }
  if (typeof body.householdSize === "number") {
    update.householdSize = body.householdSize;
  }
  if (typeof body.budget === "string") update.budget = body.budget;
  if (typeof body.maxCookTime === "number") update.maxCookTime = body.maxCookTime;
  if (typeof body.onboarded === "boolean") update.onboarded = body.onboarded;

  const result = await writePreferences(update);
  console.log("[api/preferences] saved:", result.preferences);
  return Response.json(result);
}
