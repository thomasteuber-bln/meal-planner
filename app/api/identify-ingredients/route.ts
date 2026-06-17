import type { Lang } from "@/lib/recipes";
import { identifyIngredientsFromImage } from "@/lib/identifyIngredientsFromImage";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    imageBase64?: string;
    mimeType?: string;
    language?: Lang;
  };

  const imageBase64 = body.imageBase64?.trim() ?? "";
  const mimeType = body.mimeType?.trim() ?? "";
  const language: Lang = body.language === "de" ? "de" : "en";

  console.log("\n[api/identify-ingredients] scan requested", {
    mimeType,
    language,
    bytesApprox: imageBase64.length,
  });

  const result = await identifyIngredientsFromImage({
    imageBase64,
    mimeType,
    language,
  });

  if ("error" in result) {
    console.log("[api/identify-ingredients] error:", result.error);
    return Response.json(result, { status: 400 });
  }

  return Response.json(result);
}
