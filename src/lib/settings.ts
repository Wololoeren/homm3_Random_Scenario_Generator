import type { Disabled } from "./types";

const KEY = "homm3bg-scenario-generator.settings";

export interface Settings {
  /** Entry ids switched off per Data column; map filenames under "map". */
  disabled: Disabled;
  /** Strip the artwork and colour so a printout costs less ink. */
  economy: boolean;
}

export const emptySettings: Settings = { disabled: {}, economy: false };

export function loadSettings(): Settings {
  if (typeof window === "undefined") return emptySettings;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptySettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { disabled: parsed.disabled ?? {}, economy: parsed.economy ?? false };
  } catch {
    return emptySettings;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or a full quota — the app still works, it just forgets.
  }
}

export function toggleDisabled(
  disabled: Disabled,
  columnId: string,
  entryId: string,
): Disabled {
  const current = disabled[columnId] ?? [];
  const next = current.includes(entryId)
    ? current.filter((id) => id !== entryId)
    : [...current, entryId];
  const out = { ...disabled };
  if (next.length) out[columnId] = next;
  else delete out[columnId];
  return out;
}

export function setColumnDisabled(
  disabled: Disabled,
  columnId: string,
  entryIds: string[],
): Disabled {
  const out = { ...disabled };
  if (entryIds.length) out[columnId] = entryIds;
  else delete out[columnId];
  return out;
}
