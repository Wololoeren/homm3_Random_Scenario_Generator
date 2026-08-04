import mapsJson from "@/data/maps.json";
import scenarioJson from "@/data/scenario.json";
import { fieldSpecs, type FieldSpec } from "./presets";
import type {
  DataColumn,
  Disabled,
  Field,
  Locks,
  Mode,
  PlayerCount,
  Scenario,
  ScenarioData,
} from "./types";

export const scenarioData = scenarioJson as ScenarioData;

const maps = mapsJson as {
  scenario: Record<Mode, Record<string, string[]>>;
};

export function columnById(id: string): DataColumn | undefined {
  return scenarioData.columns.find((c) => c.id === id);
}

export function mapPool(mode: Mode, players: PlayerCount): string[] {
  return maps.scenario[mode][String(players)] ?? [];
}

function enabled<T extends { id: string }>(items: T[], off: string[] | undefined): T[] {
  if (!off?.length) return items;
  const skip = new Set(off);
  return items.filter((item) => !skip.has(item.id));
}

function pick<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Roll a scenario.
 *
 * Locked fields keep whatever `previous` had, so the same call handles both a
 * fresh generation (no previous, no locks) and "reroll the unlocked lines".
 * Fields sharing a `group` — the three AI behaviours — are drawn without
 * replacement so the sheet never lists the same behaviour twice.
 */
export function generate(
  mode: Mode,
  players: PlayerCount,
  disabled: Disabled,
  locks: Locks = [],
  previous?: Scenario,
): Scenario {
  const locked = new Set(locks);
  const previousFields = new Map((previous?.fields ?? []).map((f) => [f.key, f]));
  const sameShape = previous?.mode === mode;

  // Entry ids already used by this roll, per group, including kept locks.
  const groupUsed = new Map<string, Set<string>>();
  const specs = fieldSpecs(mode, players);
  for (const spec of specs) {
    if (!spec.group || !locked.has(spec.key)) continue;
    const kept = sameShape ? previousFields.get(spec.key) : undefined;
    if (kept?.entryId) {
      const used = groupUsed.get(spec.group) ?? new Set<string>();
      used.add(kept.entryId);
      groupUsed.set(spec.group, used);
    }
  }

  const fields: Field[] = specs.map((spec: FieldSpec) => {
    if (!spec.source) {
      return { key: spec.key, label: spec.label, text: spec.text ?? "" };
    }

    const kept = sameShape ? previousFields.get(spec.key) : undefined;
    if (locked.has(spec.key) && kept) return kept;

    const column = columnById(spec.source);
    let pool = enabled(column?.entries ?? [], disabled[spec.source]);

    if (spec.group) {
      const used = groupUsed.get(spec.group) ?? new Set<string>();
      // Only enforce distinctness while there is something left to be distinct from.
      const distinct = pool.filter((e) => !used.has(e.id));
      if (distinct.length) pool = distinct;
    }

    const entry = pick(pool);
    if (spec.group && entry) {
      const used = groupUsed.get(spec.group) ?? new Set<string>();
      used.add(entry.id);
      groupUsed.set(spec.group, used);
    }

    return {
      key: spec.key,
      label: spec.label,
      source: spec.source,
      entryId: entry?.id,
      text: entry?.text ?? "—",
    };
  });

  let map = sameShape && locked.has("map") ? (previous?.map ?? null) : null;
  if (!map) {
    const pool = mapPool(mode, players).filter(
      (name) => !(disabled.map ?? []).includes(name),
    );
    map = pick(pool) ?? null;
  }

  return { mode, players, fields, map };
}

/** Reroll one line, leaving the rest of the sheet alone. */
export function rerollField(
  scenario: Scenario,
  key: string,
  disabled: Disabled,
): Scenario {
  if (key === "map") {
    const pool = mapPool(scenario.mode, scenario.players).filter(
      (name) => name !== scenario.map && !(disabled.map ?? []).includes(name),
    );
    return { ...scenario, map: pick(pool) ?? scenario.map };
  }

  const spec = fieldSpecs(scenario.mode, scenario.players).find((s) => s.key === key);
  if (!spec?.source) return scenario;

  // Avoid handing back the value that is already there, and — for the AI
  // behaviours — anything its siblings are showing.
  const taken = new Set<string>();
  const current = scenario.fields.find((f) => f.key === key);
  if (current?.entryId) taken.add(current.entryId);
  if (spec.group) {
    for (const other of scenario.fields) {
      if (other.key === key) continue;
      const otherSpec = fieldSpecs(scenario.mode, scenario.players).find(
        (s) => s.key === other.key,
      );
      if (otherSpec?.group === spec.group && other.entryId) taken.add(other.entryId);
    }
  }

  const column = columnById(spec.source);
  const pool = enabled(column?.entries ?? [], disabled[spec.source]);
  const fresh = pool.filter((e) => !taken.has(e.id));
  const entry = pick(fresh.length ? fresh : pool);
  if (!entry) return scenario;

  return {
    ...scenario,
    fields: scenario.fields.map((f) =>
      f.key === key ? { ...f, entryId: entry.id, text: entry.text } : f,
    ),
  };
}

/** How many entries a column has left once the user's exclusions are applied. */
export function remainingCount(columnId: string, disabled: Disabled): number {
  const column = columnById(columnId);
  return enabled(column?.entries ?? [], disabled[columnId]).length;
}
