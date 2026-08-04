export type CampaignMode = "solo" | "coop";

/** One of the five faction leaders the campaign is cast with. */
export interface Character {
  faction: string;
  hero: string;
  epithet: string;
}

export interface Cast {
  players: Character[];
  enemies: Character[];
  /** The word the story calls the enemies collectively ("brutes", "tyrans"…). */
  villains: string;
}

export interface ActField {
  key: string;
  label: string;
  text: string;
  /** Data column this was rolled from, if it was rolled. */
  source?: string;
  entryId?: string;
}

export interface Act {
  act: number;
  map: string | null;
  fields: ActField[];
}

export interface Campaign {
  mode: CampaignMode;
  cast: Cast;
  acts: Act[];
}

export interface RawActField {
  label: string;
  kind: "text" | "roll" | "map" | "formula";
  source: string | null;
  text: string;
}

export interface RawAct {
  act: number;
  fields: Record<string, RawActField>;
}

export interface CampaignData {
  columns: {
    id: string;
    column: string;
    label: string;
    entries: { id: string; text: string }[];
  }[];
  epithets: string[];
  villainWords: string[];
  acts: Record<CampaignMode, RawAct[]>;
  reference: {
    heroes: Record<string, string[]>;
    specialities: Record<string, string>;
    aiArmy: {
      title: string;
      headers: string[];
      rows: string[][];
      behaviours?: (number | null)[][];
    }[];
    aiRules: string[];
    glossary: { term: string; text: string; note: string }[];
  };
}
