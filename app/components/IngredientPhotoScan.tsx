"use client";

import { useRef, useState } from "react";
import type { Lang } from "@/lib/recipes";
import { getT } from "@/lib/i18n";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function mergeIngredientLists(existing: string, found: string[]): string {
  const items = [
    ...existing
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean),
    ...found,
  ];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.join(", ");
}

export function IngredientPhotoScan({
  lang,
  ingredients,
  onIngredientsChange,
  disabled,
}: {
  lang: Lang;
  ingredients: string;
  onIngredientsChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = getT(lang);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanError(null);
    setLastCount(null);
    setPreviewUrl(URL.createObjectURL(file));
    setScanning(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch("/api/identify-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: file.type,
          language: lang,
        }),
      });
      const data = (await res.json()) as
        | { count: number; ingredients: string[] }
        | { error: string };

      if (!res.ok || "error" in data) {
        setScanError("error" in data ? data.error : t("photoScanError"));
        return;
      }

      onIngredientsChange(mergeIngredientLists(ingredients, data.ingredients));
      setLastCount(data.count);
    } catch {
      setScanError(t("photoScanError"));
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="photo-scan">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="photo-scan__input"
        onChange={handleFileChange}
        disabled={disabled || scanning}
        aria-label={t("photoScanButton")}
      />
      <button
        type="button"
        className="btn photo-scan__btn"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || scanning}
      >
        {scanning ? t("photoScanning") : t("photoScanButton")}
      </button>
      {previewUrl && (
        <img
          className="photo-scan__preview"
          src={previewUrl}
          alt=""
          width={72}
          height={72}
        />
      )}
      {lastCount !== null && lastCount > 0 && (
        <p className="photo-scan__success">
          {t("photoScanFound").replace("{count}", String(lastCount))}
        </p>
      )}
      {lastCount === 0 && (
        <p className="photo-scan__hint">{t("photoScanNone")}</p>
      )}
      {scanError && <p className="photo-scan__error">{scanError}</p>}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read failed"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
