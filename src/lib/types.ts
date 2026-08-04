export type Mode = "coop" | "clash";

export type PlayerCount = 2 | 3 | 4 | 5 | 6;

export interface Entry {
  id: string;
  text: string;
}

/** One Data-tab column: the pool a single scenario slot rolls on. */
export interface DataColumn {
  id: string;
  column: string;
  label: string;
  entries: Entry[];
}

export interface ReferenceTable {
  title: string;
  headers: string[];
  rows: string[][];
  /**
   * How many AI behaviours each army fights with, parallel to `rows`. The
   * spreadsheet stores this as the cell's fill colour rather than as text —
   * green none, yellow one, orange two, red three — so it is read back out at
   * extraction time and printed as skill glyphs instead.
   */
  behaviours?: (number | null)[][];
}

export interface GlossaryEntry {
  term: string;
  text: string;
  note: string;
}

export interface ScenarioData {
  columns: DataColumn[];
  reference: {
    stack: ReferenceTable;
    aiArmy: ReferenceTable[];
    behaviourCount: string[];
    aiRules: string[];
    glossary: GlossaryEntry[];
  };
}

/**
 * A single line of the generated sheet. `source` is the Data column it was
 * rolled from; fixed lines (income, glossary pointers) have none and can never
 * be locked or rerolled.
 */
export interface Field {
  key: string;
  label: string;
  source?: string;
  entryId?: string;
  text: string;
}

export interface Scenario {
  mode: Mode;
  players: PlayerCount;
  fields: Field[];
  map: string | null;
}

/** Entry ids the user has switched off, keyed by column id. Maps use "map". */
export type Disabled = Record<string, string[]>;

/** Field keys (plus "map") the user has pinned against rerolls. */
export type Locks = string[];
