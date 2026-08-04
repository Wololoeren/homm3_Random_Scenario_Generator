"use client";

import React, { createContext, useContext } from "react";
import { asset } from "@/lib/assets";

/**
 * The tier stars, and the shorthand the spreadsheet writes armies in.
 *
 * Two notations show up:
 *   "2B", "1S+1G", "3Bs"     — a count of Bronze/Silver/Gold/Azure units,
 *                              an "s" suffix meaning the unit is stacked.
 *   "T1F", "T2P", "T2-6P"    — a faction tier (or range), Few or Packed.
 *
 * Both render as the star of the matching tier; stacked and packed units get a
 * second star behind, and faction tiers carry their number on the star.
 */

/** Set on the printable area when ink-saver mode is on. */
export const MonochromeContext = createContext(false);

/**
 * Set where glyphs sit on a dark panel rather than on the parchment. Some
 * glyphs ship a "-yellow" variant drawn for exactly that.
 */
export const DarkBackgroundContext = createContext(false);

const LETTER_GLYPH: Record<string, string> = {
  B: "bronze",
  S: "silver",
  G: "golden",
  A: "azure",
};

/** Faction tiers map onto unit colours as set out in the glossary. */
function tierGlyph(tier: number): string {
  if (tier <= 3) return "bronze";
  if (tier <= 5) return "silver";
  return "golden";
}

export function TierStar({
  glyph,
  label,
  stacked,
}: {
  glyph: string;
  label?: string;
  stacked?: boolean;
}) {
  const mono = useContext(MonochromeContext);
  const src = asset(`/glyphs/${glyph}${mono ? "-mono" : ""}.svg`);
  const classes = ["tierStar"];
  if (stacked) classes.push("stacked");
  // The monochrome stars carry the tier letter in their middle, so a labelled
  // star needs room to move the number off it.
  if (label) classes.push("labelled");
  return (
    <span className={classes.join(" ")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {stacked && <img className="starBack" src={src} alt="" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="starFront" src={src} alt={glyph} />
      {label && <span className="starLabel">{label}</span>}
    </span>
  );
}

/**
 * Faction tier shorthand. Kept separate from the counted form because the
 * scenario body uses this one but must not have its "5G" turned into units —
 * there it means five gold.
 */
export const TIER_PATTERN = /T(\d)(?:\s*-\s*(\d))?\s*([FP])\b/g;

/** Counted units, as the Stack and AI-army tables write them. */
export const COUNT_PATTERN = /(\d+)\s?([BSGA])(s)?\b/g;

export interface Match {
  index: number;
  length: number;
  node: React.ReactNode;
}

export function tierMatches(text: string, keyPrefix: string): Match[] {
  const out: Match[] = [];
  let m: RegExpExecArray | null;
  TIER_PATTERN.lastIndex = 0;
  while ((m = TIER_PATTERN.exec(text)) !== null) {
    const [full, from, to, kind] = m;
    const low = Number(from);
    const high = to ? Number(to) : low;
    out.push({
      index: m.index,
      length: full.length,
      node: (
        <TierStar
          key={`${keyPrefix}-t${m.index}`}
          // A range spans colours; the strongest unit in it sets the star.
          glyph={tierGlyph(high)}
          label={to ? `${low}-${high}` : String(low)}
          stacked={kind === "P"}
        />
      ),
    });
  }
  return out;
}

function countMatches(text: string, keyPrefix: string, repeat: boolean): Match[] {
  const out: Match[] = [];
  let m: RegExpExecArray | null;
  COUNT_PATTERN.lastIndex = 0;
  while ((m = COUNT_PATTERN.exec(text)) !== null) {
    const [full, count, letter, stacked] = m;
    const glyph = LETTER_GLYPH[letter];
    const isStacked = Boolean(stacked);
    const key = `${keyPrefix}-c${m.index}`;

    // Small armies read better as that many stars; the enemy stacks run to
    // eight of a colour, so those stay written as a count.
    out.push({
      index: m.index,
      length: full.length,
      node: repeat ? (
        <span className="starGroup" key={key}>
          {Array.from({ length: Number(count) }, (_, i) => (
            <TierStar key={i} glyph={glyph} stacked={isStacked} />
          ))}
        </span>
      ) : (
        <span className="amount" key={key}>
          {count}
          <TierStar glyph={glyph} stacked={isStacked} />
        </span>
      ),
    });
  }
  return out;
}

/** Splice rendered matches back into the surrounding text, in order. */
export function weave(text: string, matches: Match[]): React.ReactNode[] {
  const ordered = [...matches].sort((a, b) => a.index - b.index);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of ordered) {
    if (match.index < cursor) continue; // overlapping match, first one wins
    if (match.index > cursor) out.push(text.slice(cursor, match.index));
    out.push(match.node);
    cursor = match.index + match.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** Faction tiers only — safe to use on scenario prose. */
export function renderTiers(text: string, keyPrefix: string): React.ReactNode[] {
  return weave(text, tierMatches(text, keyPrefix));
}

/**
 * Both notations — for the reference tables, which carry no resource amounts.
 * With `repeat`, "3B" draws three stars instead of a 3 beside one.
 */
export function renderUnitNotation(
  text: string,
  keyPrefix = "u",
  repeat = false,
): React.ReactNode[] {
  return weave(text, [
    ...tierMatches(text, keyPrefix),
    ...countMatches(text, keyPrefix, repeat),
  ]);
}

export default function UnitNotation({
  text,
  repeat,
}: {
  text: string;
  repeat?: boolean;
}) {
  return <>{renderUnitNotation(text, "u", repeat)}</>;
}
