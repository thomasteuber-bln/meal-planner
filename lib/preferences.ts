import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeStoredPreferences } from "./profileOptions";

export interface Preferences {
  /** Lifestyle diet, e.g. vegetarian or pescetarian. */
  diet: string[] | null;
  /** Intolerances and common allergies. */
  allergies: string[] | null;
  /** Free-text ingredients to avoid. */
  dislikes: string[] | null;
  /** Saved macro-oriented nutrition goal. */
  nutritionGoal: string | null;
  budget: string | null;
  householdSize: number | null;
  maxCookTime: number | null;
  /** Set once the user has completed the onboarding flow. */
  onboarded: boolean;
}

export type PreferenceKey = "diet" | "dislikes" | "budget" | "householdSize" | "maxCookTime";

const PREFERENCE_KEYS: PreferenceKey[] = [
  "diet",
  "dislikes",
  "budget",
  "householdSize",
  "maxCookTime",
];

const PREFERENCES_PATH = path.join(process.cwd(), "data", "preferences.json");

const EMPTY_PREFERENCES: Preferences = {
  diet: null,
  allergies: null,
  dislikes: null,
  nutritionGoal: null,
  budget: null,
  householdSize: null,
  maxCookTime: null,
  onboarded: false,
};

function isMissing(value: Preferences[PreferenceKey]): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export interface ReadPreferencesResult {
  preferences: Preferences;
  /** Keys whose value is not yet set — the agent should ask about these. */
  missing: PreferenceKey[];
}

export async function readPreferences(): Promise<ReadPreferencesResult> {
  let preferences: Preferences = { ...EMPTY_PREFERENCES };

  try {
    const raw = await readFile(PREFERENCES_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    preferences = normalizeStoredPreferences(parsed);
  } catch (err) {
    // Missing or invalid file → treat every preference as unset.
    console.warn("[preferences] could not read preferences file:", err);
  }

  const missing = PREFERENCE_KEYS.filter((key) => isMissing(preferences[key]));

  return { preferences, missing };
}

export type PreferencesUpdate = Partial<Preferences>;

/**
 * Merge `update` into the saved preferences and persist them to disk.
 * Only keys present in `update` are changed; everything else is preserved.
 */
export async function writePreferences(
  update: PreferencesUpdate,
): Promise<ReadPreferencesResult> {
  const { preferences: current } = await readPreferences();

  const next: Preferences = { ...current };
  for (const key of Object.keys(update) as (keyof Preferences)[]) {
    if (update[key] !== undefined) {
      // @ts-expect-error keyed assignment across the union is safe here
      next[key] = update[key];
    }
  }

  await mkdir(path.dirname(PREFERENCES_PATH), { recursive: true });
  await writeFile(PREFERENCES_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  const missing = PREFERENCE_KEYS.filter((key) => isMissing(next[key]));
  return { preferences: next, missing };
}
