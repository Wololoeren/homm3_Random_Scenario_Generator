"use client";

import React from "react";
import { scenarioData } from "@/lib/generate";
import { asset } from "@/lib/assets";
import GameText from "./GameText";
import UnitNotation, { TierStar, renderUnitNotation } from "./UnitGlyphs";
import type { ReferenceTable } from "@/lib/types";

/**
 * The Stack / AI-army / AI / Glossary tabs, printed as an appendix. Text here
 * is left as plain strings: "4G" in these tables means four Gold units, so the
 * resource-icon substitution used on the scenario sheet would be wrong.
 */

/**
 * What each table is for, printed under it. Wording follows the Glossary and
 * AI tabs of the source spreadsheet rather than adding rules of its own; the
 * two places it goes further are called out in comments.
 */
const TABLE_NOTES: Record<string, React.ReactNode> = {
  "Enemy Stacks": (
    <>
      The complete stack guarding the Field, by player count and difficulty. Draw 5
      random Units from it and fight as normal; Units that die are removed from the
      stack, and the Field is won when the last of them falls. A reinforced stack
      draws a replacement onto the enemy back line whenever one dies; against a
      resurrecting stack every Unit in a Combat must fall together or they all
      return to the stack.{" "}
      {/* Scaling beyond 4 players is not in the spreadsheet — supplied by the author. */}
      <strong>Five players:</strong> clear the 3-player stack, reshuffle, then run the
      2-player stack. <strong>Six players:</strong> run the 3-player stack twice.
    </>
  ),
  "AI-Hero": (
    <>
      An AI army of neutral Units. Look the composition up when the army is first
      fought, using the Round the Combat happens in — not the Round it spawned — and
      keep it for the rest of the scenario. Losses are permanent. AI-Heroes use the
      AI behaviors rolled on the scenario sheet.
    </>
  ),
  "AI-faction-Hero": (
    <>
      An army drawn from a Faction nobody is playing, listed by Unit tier: the star
      carries the tier and is doubled when that tier arrives Packed rather than Few.
      The Faction is fixed when the Field it stands on is revealed. The same army
      without AI behaviors is a plain Faction army.
    </>
  ),
  "Stacking AI-Hero": (
    <>
      A harsher AI-Hero: some Units arrive already carrying a Stack Token, shown by
      the doubled star. Use this table in place of the AI-Hero table when the
      scenario calls for it.
    </>
  ),
};

/** One skill glyph per AI behaviour the army fights with. None shows nothing. */
function Behaviours({ count }: { count: number }) {
  if (!count) return null;
  const label = `${count} AI behavior${count === 1 ? "" : "s"}`;
  return (
    // Labelled rather than carrying hidden text, so the glyphs do not turn up
    // twice in the key that sits under the tables.
    <span className="behaviours" role="img" aria-label={label} title={label}>
      {Array.from({ length: count }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} className="skillGlyph" src={asset("/glyphs/skill.svg")} alt="" />
      ))}
    </span>
  );
}

const LETTER_STARS: Record<string, string> = {
  B: "bronze",
  S: "silver",
  G: "golden",
  A: "azure",
};

/**
 * Entries for the icons themselves, which the spreadsheet has no rows for —
 * the doubled star is this app's way of drawing what the sheets write as a
 * "s" suffix or a Packed tier.
 */
const ICON_ENTRIES: { key: string; icon: React.ReactNode; text: string }[] = [
  {
    key: "stacked",
    icon: <TierStar glyph="bronze" stacked />,
    text: "A doubled star is a Unit carrying a Stack Token — a “stacked” Unit.",
  },
  {
    key: "tier-few",
    icon: <TierStar glyph="golden" label="7" />,
    text: "A numbered star is a Faction Unit of that Tier, Few. The colour gives its rank: Tiers 1–3 Bronze, 4–5 Silver, 6–7 Gold.",
  },
  {
    key: "tier-packed",
    icon: <TierStar glyph="golden" label="7" stacked />,
    text: "The same doubled is that Tier Packed. A number range covers every Tier in it, coloured by the highest.",
  },
];

/**
 * A glossary term with the icon it stands for. Terms that are now drawn as an
 * icon everywhere lose their letter — the icon is the term. The rest keep
 * their wording, since explaining it is the point of the entry.
 */
function GlossaryTerm({ term }: { term: string }) {
  const star = LETTER_STARS[term];
  if (star) return <TierStar glyph={star} />;

  if (term === "MP") {
    return (
      <>
        {term}{" "}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="glyph" src={asset("/glyphs/movement.svg")} alt="movement" />
      </>
    );
  }

  // "T7F", "T2P+st" and friends: show the stars the notation resolves to.
  const glyphs = renderUnitNotation(term, `term-${term}`).filter(
    (node) => typeof node !== "string",
  );
  if (glyphs.length) {
    return (
      <>
        {term} {glyphs}
      </>
    );
  }

  return <>{term}</>;
}

/** Tables whose armies are small enough to draw a star per unit. */
const REPEAT_STARS = new Set(["AI-Hero", "Stacking AI-Hero"]);

function Table({ table }: { table: ReferenceTable }) {
  const note = TABLE_NOTES[table.title];
  const repeat = REPEAT_STARS.has(table.title);
  return (
    <div className="refTable">
      <h3>{table.title}</h3>
      <table>
        <thead>
          <tr>
            <th />
            {table.headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={row[0]}>
              {row.map((cell, i) => {
                const behaviours = table.behaviours?.[r]?.[i];
                return (
                  <td key={i} className={i === 0 ? "rowHead" : undefined}>
                    {i === 0 ? (
                      cell
                    ) : (
                      // Drawn one star per unit, the "+" between groups is
                      // just noise, so it goes.
                      <UnitNotation
                        text={repeat ? cell.replace(/\s*\+\s*/g, " ") : cell}
                        repeat={repeat}
                      />
                    )}
                    {typeof behaviours === "number" && <Behaviours count={behaviours} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="tableNote">{note}</p>}
    </div>
  );
}

/**
 * One printed page. The parchment and footer bar are absolutely positioned
 * inside it, so every page carries them — a fixed-position element would only
 * be painted on the first page of a print job.
 */
function Page({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="sheet reference">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pageTexture" src={asset("/layout/tausta.webp")} alt="" />
      <div className="sheetInner">
        {title && (
          <header className="sheetHeader compact">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="headerFrame" src={asset("/layout/section_heading.webp")} alt="" />
            <div className="sheetTitles">
              <h1 className="sheetTitle">{title}</h1>
            </div>
          </header>
        )}
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pageFooter" src={asset("/layout/bottom.webp")} alt="" />
      <span className="pageNumber" />
    </article>
  );
}

export default function ReferenceSheet({ coop }: { coop: boolean }) {
  const { stack, aiArmy, aiRules, glossary } = scenarioData.reference;

  // Written terms first, then everything explained by an icon, so the stars
  // read as one block at the foot of the glossary.
  const written = glossary.filter((item) => !(item.term in LETTER_STARS));
  const stars = glossary.filter((item) => item.term in LETTER_STARS);

  const glossaryBlock = (
    <div className="refBlock">
      <h3>Glossary</h3>
      <dl className="glossary">
        {written.map((item) => (
          <React.Fragment key={item.term}>
            <dt>
              <GlossaryTerm term={item.term} />
            </dt>
            <dd>
              <UnitNotation text={item.text} />
              {item.note && <span className="glossaryNote"> ({item.note})</span>}
            </dd>
          </React.Fragment>
        ))}
        {stars.map((item) => (
          <React.Fragment key={item.term}>
            <dt>
              <GlossaryTerm term={item.term} />
            </dt>
            <dd>
              <UnitNotation text={item.text} />
              {item.note && <span className="glossaryNote"> ({item.note})</span>}
            </dd>
          </React.Fragment>
        ))}
        {ICON_ENTRIES.map((item) => (
          <React.Fragment key={item.key}>
            <dt>{item.icon}</dt>
            <dd>{item.text}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="tableNote">
        Shorthand used across the scenario sheet and the tables above.
      </p>
    </div>
  );

  if (!coop) {
    return (
      <Page title="Reference">
        <Table table={stack} />
        {glossaryBlock}
      </Page>
    );
  }

  return (
    <>
      <Page title="Reference">
        <Table table={stack} />
        <Table table={aiArmy[0]} />
      </Page>

      <Page>
        <Table table={aiArmy[1]} />
        <Table table={aiArmy[2]} />
      </Page>

      <Page>
        <div className="refBlock">
          <h3>Number of AI behaviors</h3>
          <p className="line">
            Each <Behaviours count={1} /> beside an army above is one AI behavior it
            fights with — none, <Behaviours count={1} />, <Behaviours count={2} /> or{" "}
            <Behaviours count={3} />. Before drawing the enemy Unit cards, roll an
            attack-dice for each behavior to see which is active; they stack if you
            roll the same.
          </p>
        </div>

        <div className="refBlock">
          <h3>AI movement &amp; combat</h3>
          <ul>
            {aiRules.map((line, i) => (
              <li key={i}>
                <GameText text={line} />
              </li>
            ))}
          </ul>
          <p className="tableNote">
            How an AI army behaves outside Combat — where it spawns, how it chases
            Heroes, and what defeating it pays out.
          </p>
        </div>
      </Page>

      <Page>{glossaryBlock}</Page>
    </>
  );
}
