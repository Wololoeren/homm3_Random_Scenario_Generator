import type { Mode, PlayerCount } from "./types";

/**
 * The shape of a scenario sheet: which lines are rolled, which are fixed, and
 * how they group under the Mission Book's section headings.
 *
 * Fixed wording is taken from the per-player-count tabs of the spreadsheet,
 * where it is typed in directly rather than pulled from Data.
 */

const STARTING_TILES =
  "If the map has less far-tiles than 2 per player each player start with the remaining far-tiles. " +
  "If the map has less near-tiles than 2 per player each player start with the remaining near-tiles.";

const OBELISK_INFO = "Obelisks can be claimed once per player.";

const AI_INFO =
  "Roll an attack-dice for each behavior before drawing the enemy unit cards, to determine " +
  "which behavior is active — they stack if you roll the same. See the AI-Hero tables for " +
  "the number of behaviors in play.";

const SCENARIO_LENGTH =
  "This Scenario is played over 12 Rounds on Easy, 13 on Normal, 14 on Hard and 15 on " +
  "Impossible. Complete the Victory Condition before the last Round ends, unless otherwise " +
  "specified.";

const AI_ONLY = "Only for Scenarios with an AI army.";

/** Coop gains building materials income from 3 players up; clash never does. */
function startingIncome(mode: Mode, players: PlayerCount): string {
  if (mode === "coop" && players >= 3) return "10G + 2BM + 0V";
  return "10G + 0BM + 0V";
}

export interface FieldSpec {
  key: string;
  label: string;
  /** Data column id to roll on. Omitted for fixed text. */
  source?: string;
  /** Fixed text, used when there is no source. */
  text?: string;
  /** Rolled with its siblings so the three AI behaviours never repeat. */
  group?: string;
  /**
   * "runIn" prints a bold label followed by the text, the way the Mission Book
   * writes Player Setup. "prose" drops the label and lets the section heading
   * carry it.
   */
  display: "runIn" | "prose";
}

export interface SectionSpec {
  id: string;
  heading: string;
  /** Italic line under the heading. */
  note?: string;
  fields: FieldSpec[];
}

export function sheetSections(mode: Mode, players: PlayerCount): SectionSpec[] {
  const sections: SectionSpec[] = [
    {
      id: "length",
      heading: "Scenario Length",
      fields: [
        { key: "lastRound", label: "Last Round", text: SCENARIO_LENGTH, display: "prose" },
      ],
    },
    {
      id: "setup",
      heading: "Player Setup",
      fields: [
        { key: "playerCount", label: "Player Count", text: String(players), display: "runIn" },
        { key: "buildings", label: "Starting Buildings", source: "buildings", display: "runIn" },
        { key: "resources", label: "Starting Resources", source: "resources", display: "runIn" },
        { key: "income", label: "Starting Income", text: startingIncome(mode, players), display: "runIn" },
        { key: "army", label: "Starting Army", source: "army", display: "runIn" },
        { key: "tiles", label: "Starting Tiles", text: STARTING_TILES, display: "runIn" },
      ],
    },
    {
      id: "victory",
      heading: "Victory Conditions",
      fields: [
        {
          key: "victory",
          label: "Victory Conditions",
          source: mode === "coop" ? "victoryCoop" : "victoryClash",
          display: "prose",
        },
      ],
    },
    {
      id: "timed",
      heading: "Timed Events",
      fields: [
        { key: "timedEvents", label: "Timed Events", source: "timedEvents", display: "prose" },
      ],
    },
    {
      id: "obelisks",
      heading: "Obelisks",
      fields: [
        { key: "obelisk", label: "Reward", source: "obelisk", display: "runIn" },
        { key: "obeliskInfo", label: "Obelisks info", text: OBELISK_INFO, display: "prose" },
      ],
    },
    {
      id: "rules",
      heading: "Additional Rules",
      fields: [
        { key: "positive", label: "Positive", source: "positive", display: "runIn" },
        { key: "neutral", label: "Neutral", source: "neutral", display: "runIn" },
        { key: "negative", label: "Negative", source: "negative", display: "runIn" },
      ],
    },
  ];

  if (mode === "coop") {
    sections.push({
      id: "ai",
      heading: "AI Behavior",
      note: AI_ONLY,
      fields: [
        { key: "aiMinus", label: "−1", source: "aiBehaviour", group: "ai", display: "runIn" },
        { key: "aiZero", label: "0", source: "aiBehaviour", group: "ai", display: "runIn" },
        { key: "aiPlus", label: "+1", source: "aiBehaviour", group: "ai", display: "runIn" },
        { key: "aiInfo", label: "AI info", text: AI_INFO, display: "prose" },
      ],
    });
  }

  return sections;
}

/** Flattened field order — what the roller walks. */
export function fieldSpecs(mode: Mode, players: PlayerCount): FieldSpec[] {
  return sheetSections(mode, players).flatMap((section) => section.fields);
}
