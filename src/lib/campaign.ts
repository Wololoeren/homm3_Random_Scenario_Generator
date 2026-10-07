import campaignJson from "@/data/campaign.json";
import mapsJson from "@/data/maps.json";
import { storyTemplate } from "./campaignStory";
import type {
  Act,
  ActField,
  Campaign,
  CampaignData,
  CampaignMode,
  Cast,
  Character,
  RawAct,
} from "./campaignTypes";
import type { Disabled, Locks } from "./types";

export const campaignData = campaignJson as unknown as CampaignData;

const maps = mapsJson as {
  campaign: Record<CampaignMode, Record<string, string[]>>;
};

/** Act 1 rolls an obelisk reward that the spreadsheet buries in its briefing. */
const OBELISK_FIELD = "obelisk";

/** Coop draws two tile sets, one per player, and joins them. */
const COOP_TILE_LEADS = [
  "Randomly select far tiles from",
  "Use",
];

function pick<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function columnEntries(id: string, disabled: Disabled) {
  const column = campaignData.columns.find((c) => c.id === id);
  const off = new Set(disabled[`campaign.${id}`] ?? []);
  return (column?.entries ?? []).filter((e) => !off.has(e.id));
}

/** Heroes are switched off by name — they are unique across all ten factions. */
export const HERO_KEY = "campaign.hero";

export function heroesOf(faction: string, disabled: Disabled): string[] {
  const off = new Set(disabled[HERO_KEY] ?? []);
  return (campaignData.reference.heroes[faction] ?? []).filter((h) => !off.has(h));
}

export function campaignMapPool(mode: CampaignMode, column: string): string[] {
  return maps.campaign[mode][column] ?? [];
}

/** Lock key for one member of the cast, e.g. "cast.enemy2". */
export function castLockKey(role: "player" | "enemy", index: number): string {
  return `cast.${role}${index + 1}`;
}

/** The cast in the order it is rolled and printed. */
function castSlots(mode: CampaignMode): { role: "player" | "enemy"; index: number }[] {
  const slots: { role: "player" | "enemy"; index: number }[] = [
    { role: "player", index: 0 },
    { role: "enemy", index: 0 },
    { role: "enemy", index: 1 },
    { role: "enemy", index: 2 },
  ];
  if (mode === "coop") slots.push({ role: "player", index: 1 });
  return slots;
}

function memberOf(cast: Cast | undefined, role: "player" | "enemy", index: number) {
  if (!cast) return undefined;
  return role === "player" ? cast.players[index] : cast.enemies[index];
}

/**
 * Five faction leaders, no two from the same faction — the spreadsheet enforces
 * that with UNIQUE, and the story reads oddly without it.
 *
 * Locked members keep their character *and* hold their faction against the
 * others, so rerolling one leader can never duplicate a faction still in play.
 */
function rollCast(
  mode: CampaignMode,
  disabled: Disabled,
  locked: Set<string>,
  previous?: Cast,
): Cast {
  const factions = columnEntries("faction", disabled).map((e) => e.text);
  const epithets = campaignData.epithets;
  const slots = castSlots(mode);

  const kept = new Map<string, Character>();
  const taken: string[] = [];
  for (const { role, index } of slots) {
    const key = castLockKey(role, index);
    const previousMember = memberOf(previous, role, index);
    if (locked.has(key) && previousMember) {
      kept.set(key, previousMember);
      taken.push(previousMember.faction);
    }
  }

  const players: Character[] = [];
  const enemies: Character[] = [];

  for (const { role, index } of slots) {
    const key = castLockKey(role, index);
    let member = kept.get(key);
    if (!member) {
      const free = factions.filter((f) => !taken.includes(f));
      // Prefer factions that still have a hero switched on; fall back rather
      // than fail if the user has disabled everything.
      const playable = free.filter((f) => heroesOf(f, disabled).length);
      const faction = pick(playable.length ? playable : free.length ? free : factions) ?? "Castle";
      taken.push(faction);
      const heroes = heroesOf(faction, disabled);
      member = {
        faction,
        hero: pick(heroes.length ? heroes : campaignData.reference.heroes[faction] ?? []) ?? faction,
        epithet: pick(epithets) ?? "",
      };
    }
    if (role === "player") players[index] = member;
    else enemies[index] = member;
  }

  return {
    players,
    enemies,
    villains:
      locked.has("cast.villains") && previous
        ? previous.villains
        : (pick(campaignData.villainWords) ?? "brutes"),
  };
}

function speciality(hero: string): string {
  return campaignData.reference.specialities[hero] ?? "no special rule";
}

/** Two tile instructions joined, with the second one's lead-in trimmed. */
function coopTiles(id: string, disabled: Disabled): string {
  const entries = columnEntries(id, disabled);
  const first = pick(entries);
  const rest = entries.filter((e) => e.id !== first?.id);
  const second = pick(rest.length ? rest : entries);
  if (!first) return "—";
  if (!second) return first.text;
  let tail = second.text;
  for (const lead of COOP_TILE_LEADS) {
    if (tail.startsWith(lead)) tail = tail.slice(lead.length).trim();
  }
  return `${first.text} ${tail}`;
}

function buildField(
  key: string,
  raw: RawAct["fields"][string],
  act: number,
  mode: CampaignMode,
  cast: Cast,
  disabled: Disabled,
): ActField {
  if (raw.kind === "roll" && raw.source) {
    const entry = pick(columnEntries(raw.source, disabled));
    return {
      key,
      label: raw.label,
      source: raw.source,
      entryId: entry?.id,
      text: entry?.text ?? "—",
    };
  }

  if (raw.kind === "formula") {
    const template = storyTemplate(mode, act, key);
    if (template) {
      return { key, label: raw.label, text: template({ cast, speciality }) };
    }
    // The tile formulas concatenate rolls rather than names.
    if (key === "tiles") {
      if (mode === "coop") {
        const source = act === 4 ? "dungeonTiles" : act === 1 ? "farTiles" : "nearTiles";
        return { key, label: raw.label, source, text: coopTiles(source, disabled) };
      }
      const near =
        act === 7
          ? "Randomly select from any near tiles"
          : (pick(columnEntries("nearTiles", disabled))?.text ?? "");
      const far = pick(columnEntries("farTiles", disabled))?.text ?? "";
      // Act 6 also names the two enemy starting tiles; that goes in its own
      // line so this one stays purely a roll.
      return { key, label: raw.label, source: "farTiles", text: `${near} and ${far}` };
    }
    // No template: fall back to whatever the sheet last showed.
    return { key, label: raw.label, text: raw.text };
  }

  return { key, label: raw.label, text: raw.text };
}

export function generateCampaign(
  mode: CampaignMode,
  disabled: Disabled,
  locks: Locks = [],
  previous?: Campaign,
): Campaign {
  const locked = new Set(locks);
  const cast = rollCast(
    mode,
    disabled,
    locked,
    previous?.mode === mode ? previous.cast : undefined,
  );

  const previousActs = new Map((previous?.acts ?? []).map((a) => [a.act, a]));
  const sameShape = previous?.mode === mode;

  const acts: Act[] = campaignData.acts[mode].map((rawAct) => {
    const kept = sameShape ? previousActs.get(rawAct.act) : undefined;
    const keptFields = new Map((kept?.fields ?? []).map((f) => [f.key, f]));

    const fields: ActField[] = Object.entries(rawAct.fields)
      .filter(([key]) => key !== "map")
      .map(([key, raw]) => {
        const lockKey = `act${rawAct.act}.${key}`;
        const previousField = keptFields.get(key);
        if (locked.has(lockKey) && previousField) return previousField;
        return buildField(key, raw, rawAct.act, mode, cast, disabled);
      });

    // Act 1's briefing ends with an obelisk reward in the sheet; it reads
    // better — and is easier to reroll — as a line of its own.
    if (rawAct.act === 1) {
      const lockKey = `act1.${OBELISK_FIELD}`;
      const previousField = keptFields.get(OBELISK_FIELD);
      if (locked.has(lockKey) && previousField) {
        fields.splice(2, 0, previousField);
      } else {
        const entry = pick(columnEntries("obelisk", disabled));
        fields.splice(2, 0, {
          key: OBELISK_FIELD,
          label: "When visiting an Obelisk",
          source: "obelisk",
          entryId: entry?.id,
          text: entry?.text ?? "—",
        });
      }
    }

    // Act 6 names which factions hold the other starting tiles. Kept out of
    // the tiles roll so a cast reroll can update it on its own.
    if (rawAct.act === 6) {
      const tilesAt = fields.findIndex((f) => f.key === "tiles");
      fields.splice(tilesAt + 1, 0, {
        key: "remainingTiles",
        label: "Remaining starting tiles",
        text: `${cast.enemies[1].faction} and ${cast.enemies[0].faction}`,
      });
    }

    // In coop, the leader beaten in Act 2 comes back as a second AI in Act 3,
    // so there is one chasing each player.
    if (mode === "coop" && rawAct.act === 3) {
      const template = storyTemplate(mode, 3, "reinforcement");
      if (template) {
        const timedAt = fields.findIndex((f) => f.key === "timed");
        fields.splice(timedAt + 1, 0, {
          key: "reinforcement",
          label: "Reinforcement",
          text: template({ cast, speciality }),
        });
      }
    }

    const mapField = rawAct.fields.map;
    let map: string | null = null;
    if (mapField?.kind === "map" && mapField.source) {
      const lockKey = `act${rawAct.act}.map`;
      if (locked.has(lockKey) && kept?.map) {
        map = kept.map;
      } else {
        const pool = campaignMapPool(mode, mapField.source).filter(
          (name) => !(disabled.map ?? []).includes(name),
        );
        map = pick(pool) ?? null;
      }
    }

    return { act: rawAct.act, map, fields };
  });

  return { mode, cast, acts };
}

/**
 * Recast one leader, keeping the other four and everything already rolled.
 *
 * The cast is woven through every Act's prose, so this regenerates the
 * campaign with all rolled fields pinned: only the text built from names is
 * rebuilt, and the replacement faction is drawn from those still unused.
 */
export function rerollCastMember(
  campaign: Campaign,
  lockKey: string,
  disabled: Disabled,
): Campaign {
  const pinned: string[] = [];

  for (const { role, index } of castSlots(campaign.mode)) {
    const key = castLockKey(role, index);
    if (key !== lockKey) pinned.push(key);
  }
  pinned.push("cast.villains");

  for (const act of campaign.acts) {
    if (act.map) pinned.push(`act${act.act}.map`);
    for (const field of act.fields) {
      if (field.source) pinned.push(`act${act.act}.${field.key}`);
    }
  }

  return generateCampaign(campaign.mode, disabled, pinned, campaign);
}

/** Reroll a single act field, leaving everything else alone. */
export function rerollCampaignField(
  campaign: Campaign,
  act: number,
  key: string,
  disabled: Disabled,
): Campaign {
  return {
    ...campaign,
    acts: campaign.acts.map((a) => {
      if (a.act !== act) return a;

      if (key === "map") {
        const raw = campaignData.acts[campaign.mode].find((r) => r.act === act);
        const column = raw?.fields.map?.source;
        if (!column) return a;
        const pool = campaignMapPool(campaign.mode, column).filter(
          (name) => name !== a.map && !(disabled.map ?? []).includes(name),
        );
        return { ...a, map: pick(pool) ?? a.map };
      }

      return {
        ...a,
        fields: a.fields.map((f) => {
          if (f.key !== key || !f.source) return f;
          const pool = columnEntries(f.source, disabled);
          const fresh = pool.filter((e) => e.id !== f.entryId);
          const entry = pick(fresh.length ? fresh : pool);
          return entry ? { ...f, entryId: entry.id, text: entry.text } : f;
        }),
      };
    }),
  };
}
