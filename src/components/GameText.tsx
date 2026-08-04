import React, { useContext } from "react";
import { asset } from "@/lib/assets";
import {
  DarkBackgroundContext,
  TierStar,
  tierMatches,
  weave,
  type Match,
} from "./UnitGlyphs";

/**
 * Renders spreadsheet text the way the Mission Book prints it: resources,
 * buildings and army shorthand all become icons.
 *
 * The counted unit form ("4G" for four Gold units) is deliberately *not*
 * handled here — in scenario prose the same string means four gold. The
 * reference tables use UnitNotation for that.
 */

const RESOURCE_GLYPHS: Record<string, string> = {
  G: "gold",
  BM: "building_materials",
  V: "valuables",
  MP: "movement",
  XP: "experience",
};

const TIER_WORDS: Record<string, string> = {
  bronze: "bronze",
  silver: "silver",
  gold: "golden",
  golden: "golden",
  azure: "azure",
};

/** Deck and reward icons, as the Mission Book uses them. */
const NOUN_GLYPHS: Record<string, string> = {
  spell: "spellpower",
  artifact: "artifact",
  experience: "experience",
};

/** Faction tiers map onto unit colours as set out in the glossary. */
function tierGlyph(tier: number): string {
  if (tier <= 3) return "bronze";
  if (tier <= 5) return "silver";
  return "golden";
}

const LETTER_TIERS: Record<string, string> = {
  B: "bronze",
  S: "silver",
  G: "golden",
  A: "azure",
};

/** The two dice, each with a variant drawn for dark panels. */
const DICE_GLYPHS: Record<string, { light: string; dark: string }> = {
  resource: { light: "resource_die", dark: "resource-yellow" },
  treasure: { light: "treasure", dark: "treasure-yellow" },
};

/** Buildings keep their name; the glyph goes in front of it, as in the book. */
const BUILDING_GLYPHS: Record<string, string> = {
  camp: "building_special_tent",
  workshop: "building_special_gears",
  "city hall": "building_city_hall",
  "mage guild": "building_mage_guild",
  citadel: "building_citadel",
};

/*
 * One pass, one regex. Alternatives are tried in order at each position, so
 * the sequence below is the precedence: counted forms before bare words, and
 * "gold Dwelling" (a unit tier) before "gold" (the resource).
 *
 * Case matters. Capitalised Bronze/Silver/Gold/Azure are unit tiers; lower
 * case "gold" is the resource.
 */
const PATTERN = new RegExp(
  [
    // "1 treasure and 1 resource -dice" — the first die has no "dice" of its
    // own, so the pair has to be matched together and before either alone.
    String.raw`(?<pairT>\d+)\s+treasure\s+and\s+(?<pairR>\d+)\s+resource\s*-?\s*dice\b`,
    String.raw`(?<treasureCount>\d+|[Aa])\s+treasure\s*-?\s*dice\b`,
    String.raw`(?<resourceCount>\d+|[Aa])\s+resource\s*-?\s*dice\b`,
    String.raw`(?<amount>\d+)\s?(?<res>BM|G|V)\b`,
    // "0MP", "3MP", "½XP" — a count run straight into the keyword.
    String.raw`(?<pointAmount>\d+|½)\s?(?<point>MP|XP)\b`,
    String.raw`(?<goldAmount>\d+)\s+gold\b`,
    // "4(2xB)" — a count of Units of that tier, drawn as that many stars.
    String.raw`(?<timesCount>\d+)\s*[xX]\s*(?<timesTier>[BSGA])\b`,
    String.raw`(?<xpAmount>\d+)\s+experience\b`,
    String.raw`\b(?<keyword>MP|XP)\b`,
    String.raw`\b(?<bmWords>[Bb]uilding [Mm]aterials)\b`,
    String.raw`\b(?<valWords>[Vv]aluables)\b`,
    String.raw`\bgold(?=\s+[Dd]welling)`,
    String.raw`\b(?<goldWord>gold)\b`,
    String.raw`\b(?<bmShort>BM)\b`,
    String.raw`\b(?<vShort>V)\b`,
    // "Tier 1", "Tier 3-7" — the colour follows the highest tier named.
    String.raw`\bTier (?<tierFrom>\d)(?:\s*-\s*(?<tierTo>\d))?\b`,
    // Deck references keep their noun; the icon replaces the card type.
    String.raw`\b[Ss]pell(?<spellDeck>[- ]deck|[- ]cards?)\b`,
    String.raw`\b(?<spells>[Ss]pells)\b`,
    String.raw`\b(?<artifacts>[Aa]rtifacts?)\b`,
    String.raw`\b(?<xp>experience)\b`,
    String.raw`\b(?<building>[Cc]ity [Hh]all|[Mm]age [Gg]uild|[Cc]itadel|[Ww]orkshop|[Cc]amp)\b`,
    String.raw`\b(?<tier>[Bb]ronze|[Ss]ilver|Golden|Gold|[Aa]zure)(?<tierUnits>-units?)?\b(?! Dragon)`,
  ].join("|"),
  "g",
);

function Glyph({ name, alt }: { name: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="glyph" src={asset(`/glyphs/${name}.svg`)} alt={alt} />;
}

function resourceMatches(line: string, keyPrefix: string, dark: boolean): Match[] {
  const out: Match[] = [];
  let match: RegExpExecArray | null;
  PATTERN.lastIndex = 0;

  const die = (kind: string) => DICE_GLYPHS[kind][dark ? "dark" : "light"];
  const counted = (count: string, glyph: string, alt: string, key: string) => (
    <span className="amount" key={key}>
      {count}
      <Glyph name={glyph} alt={alt} />
    </span>
  );

  while ((match = PATTERN.exec(line)) !== null) {
    const g = match.groups ?? {};
    const full = match[0];
    const key = `${keyPrefix}-r${match.index}`;
    let node: React.ReactNode = full;

    if (g.pairT) {
      node = (
        <span key={key}>
          {counted(g.pairT, die("treasure"), "treasure dice", `${key}-t`)} and{" "}
          {counted(g.pairR, die("resource"), "resource dice", `${key}-r`)}
        </span>
      );
    } else if (g.treasureCount) {
      node = counted(g.treasureCount, die("treasure"), "treasure dice", key);
    } else if (g.resourceCount) {
      node = counted(g.resourceCount, die("resource"), "resource dice", key);
    } else if (g.tier) {
      const star = <TierStar glyph={TIER_WORDS[g.tier.toLowerCase()]} />;
      node = g.tierUnits ? (
        <span className="amount" key={key}>
          {star} {g.tierUnits.slice(1)}
        </span>
      ) : (
        <React.Fragment key={key}>{star}</React.Fragment>
      );
    } else if (g.timesCount) {
      node = (
        <span className="starGroup" key={key}>
          {Array.from({ length: Number(g.timesCount) }, (_, i) => (
            <TierStar key={i} glyph={LETTER_TIERS[g.timesTier]} />
          ))}
        </span>
      );
    } else if (g.tierFrom) {
      const high = Number(g.tierTo ?? g.tierFrom);
      node = (
        <TierStar
          key={key}
          glyph={tierGlyph(high)}
          label={g.tierTo ? `${g.tierFrom}-${g.tierTo}` : g.tierFrom}
        />
      );
    } else if (g.spellDeck) {
      node = (
        <span className="amount" key={key}>
          <Glyph name={NOUN_GLYPHS.spell} alt="spell" />
          {g.spellDeck.replace(/^[- ]/, " ")}
        </span>
      );
    } else if (g.spells || g.artifacts || g.xp) {
      // A bare noun becomes its icon — but not when it opens the sentence,
      // where an icon with no word in front of it reads badly.
      const glyph = g.spells
        ? NOUN_GLYPHS.spell
        : g.artifacts
          ? NOUN_GLYPHS.artifact
          : NOUN_GLYPHS.experience;
      node =
        match.index === 0 ? (
          full
        ) : (
          <Glyph name={glyph} alt={full.toLowerCase()} key={key} />
        );
    } else if (g.xpAmount) {
      node = counted(g.xpAmount, NOUN_GLYPHS.experience, "experience", key);
    } else if (g.amount) {
      node = (
        <span className="amount" key={key}>
          {g.amount}
          <Glyph name={RESOURCE_GLYPHS[g.res]} alt={g.res} />
        </span>
      );
    } else if (g.goldAmount) {
      node = (
        <span className="amount" key={key}>
          {g.goldAmount}
          <Glyph name="gold" alt="gold" />
        </span>
      );
    } else if (g.pointAmount) {
      node = counted(
        g.pointAmount,
        RESOURCE_GLYPHS[g.point],
        g.point,
        key,
      );
    } else if (g.keyword) {
      node = <Glyph name={RESOURCE_GLYPHS[g.keyword]} alt={g.keyword} key={key} />;
    } else if (g.bmWords || g.bmShort) {
      node = <Glyph name="building_materials" alt="building materials" key={key} />;
    } else if (g.valWords || g.vShort) {
      node = <Glyph name="valuables" alt="valuables" key={key} />;
    } else if (g.goldWord) {
      node = <Glyph name="gold" alt="gold" key={key} />;
    } else if (g.building) {
      node = (
        <span className="building" key={key}>
          <Glyph name={BUILDING_GLYPHS[g.building.toLowerCase()]} alt="" />
          {g.building}
        </span>
      );
    } else {
      // "gold Dwelling" — the tier, not the resource.
      node = <TierStar key={key} glyph="golden" />;
    }

    out.push({ index: match.index, length: full.length, node });
  }
  return out;
}

export default function GameText({ text }: { text: string }) {
  const dark = useContext(DarkBackgroundContext);
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {weave(line, [
            ...tierMatches(line, String(i)),
            ...resourceMatches(line, String(i), dark),
          ])}
        </React.Fragment>
      ))}
    </>
  );
}
