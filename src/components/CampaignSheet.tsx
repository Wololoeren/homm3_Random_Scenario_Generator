"use client";

import React from "react";
import GameText from "./GameText";
import { asset } from "@/lib/assets";
import { campaignData, castLockKey } from "@/lib/campaign";
import { heroWikiUrl } from "@/lib/wiki";
import { CAMPAIGN_RULES } from "@/lib/campaignStory";
import type { Act, ActField, Campaign } from "@/lib/campaignTypes";
import type { Locks } from "@/lib/types";

/**
 * A campaign prints as one page per Act, plus a cast page at the front. Each
 * page carries its own parchment and footer, the way the scenario sheets do —
 * see the print rules in globals.css for why the furniture cannot be shared.
 */

const SPECIALITIES = campaignData.reference.specialities;

function speciality(hero: string): string {
  return SPECIALITIES[hero] ?? "no special rule";
}

interface SectionLine {
  field: ActField;
  display: "runIn" | "prose";
  label: string;
}

interface Section {
  id: string;
  heading: string;
  note?: string;
  lines: SectionLine[];
}

/**
 * Which section each Act field belongs under.
 *
 * Rows 6–9 of the spreadsheet carry different things in different Acts — the
 * starting position in Act 1, AI behaviors in the rest — so they are routed by
 * their label rather than their key.
 */
function sectionFor(field: ActField): string {
  switch (field.key) {
    case "lastRound":
      return "length";
    case "tiles":
    case "tilesOnHand":
      return "mapSetup";
    case "victory":
      return "victory";
    case "timed":
    case "reinforcement":
      return "timed";
    case "obelisk":
      return "obelisks";
    case "actInfo":
      return "rules";
    case "reward":
    case "reward2":
    case "completion":
    case "completionStory":
      return "completion";
    default:
      if (/^AI/i.test(field.label)) return "ai";
      return "setup";
  }
}

const SECTION_ORDER: { id: string; heading: string; note?: string }[] = [
  { id: "length", heading: "Act Length" },
  { id: "setup", heading: "Player Setup" },
  { id: "mapSetup", heading: "Map Setup" },
  { id: "victory", heading: "Victory Conditions" },
  { id: "timed", heading: "Timed Events" },
  { id: "obelisks", heading: "Obelisks" },
  { id: "rules", heading: "Additional Rules" },
  { id: "ai", heading: "AI Behavior" },
  {
    id: "completion",
    heading: "Completion",
    note: "Read this only once the Victory Condition is met.",
  },
];

/** Fields that read as their own paragraph rather than a run-in label. */
const PROSE_FIELDS = new Set(["actInfo", "victory", "timed", "lastRound", "completion", "completionStory"]);

function displayOf(field: ActField): "runIn" | "prose" {
  // "AI info" is the standing note under the behaviors, not a labelled value.
  if (/^AI info/i.test(field.label)) return "prose";
  return PROSE_FIELDS.has(field.key) ? "prose" : "runIn";
}

/** "AI behavior (-1)" is all label and no information under an AI heading. */
function shortLabel(field: ActField): string {
  const ai = field.label.match(/\(([-+]?\d)\)/);
  if (ai) return ai[1].replace("-", "−");
  return field.label;
}

function buildSections(act: Act): Section[] {
  const grouped = new Map<string, SectionLine[]>();
  for (const field of act.fields) {
    if (field.key === "story") continue; // printed as the opening italic
    const id = sectionFor(field);
    const lines = grouped.get(id) ?? [];
    lines.push({ field, display: displayOf(field), label: shortLabel(field) });
    grouped.set(id, lines);
  }

  return SECTION_ORDER.filter((s) => grouped.get(s.id)?.length).map((s) => ({
    ...s,
    lines: grouped.get(s.id) ?? [],
  }));
}

interface Props {
  campaign: Campaign;
  locks: Locks;
  onToggleLock: (key: string) => void;
  onReroll: (act: number, key: string) => void;
}

function Tools({
  locked,
  onToggle,
  onReroll,
  label,
}: {
  locked: boolean;
  onToggle: () => void;
  onReroll: () => void;
  label: string;
}) {
  return (
    <span className="rowTools no-print">
      <button
        type="button"
        className={locked ? "toolButton locked" : "toolButton"}
        onClick={onToggle}
        aria-pressed={locked}
        title={locked ? `${label} is locked — click to unlock` : `Lock ${label}`}
      >
        {locked ? "🔒" : "🔓"}
      </button>
      <button
        type="button"
        className="toolButton"
        onClick={onReroll}
        disabled={locked}
        title={locked ? `Unlock ${label} to reroll it` : `Reroll ${label}`}
      >
        🎲
      </button>
    </span>
  );
}

/**
 * A hero's name, linked to their wiki page. Kept in the printed page rather
 * than hidden with the other controls: printing to PDF preserves the link, so
 * the cast stays clickable in the file.
 */
function HeroLink({ name }: { name: string }) {
  return (
    <a className="wikiLink" href={heroWikiUrl(name)} target="_blank" rel="noreferrer">
      <strong>{name}</strong>
      <svg className="wikiIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

function Sheet({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={className ? `sheet ${className}` : "sheet"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pageTexture" src={asset("/layout/tausta.webp")} alt="" />
      <div className="sheetInner">{children}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pageFooter" src={asset("/layout/bottom.webp")} alt="" />
      <span className="pageNumber" />
    </article>
  );
}

export default function CampaignSheet({
  campaign,
  locks,
  onToggleLock,
  onReroll,
}: Props) {
  const locked = new Set(locks);
  const { cast } = campaign;
  const kicker = campaign.mode === "coop" ? "Cooperative Campaign" : "Solo Campaign";

  function story(act: Act): string {
    return act.fields.find((f) => f.key === "story")?.text ?? "";
  }

  return (
    <>
      <Sheet>
        <header className="sheetHeader">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="headerFrame" src={asset("/layout/section_heading.webp")} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sheetIcon" src={asset("/layout/random.webp")} alt="" />
          <div className="sheetTitles">
            <p className="sheetKicker">{kicker}</p>
            <h1 className="sheetTitle">Random Campaign</h1>
            <p className="sheetSubtitle">
              {cast.players.length} Player{cast.players.length === 1 ? "" : "s"}
            </p>
          </div>
        </header>

        <section className="sheetSection">
          <h2>The Cast</h2>
          <p className="sectionNote">
            No two leaders share a Faction, so recasting one draws from the Factions
            still unused.
          </p>
          <dl className="cast">
            {cast.players.map((c, i) => {
              const key = castLockKey("player", i);
              return (
                <React.Fragment key={key}>
                  <dt>Player {i + 1}</dt>
                  <dd>
                    <HeroLink name={c.hero} /> {c.epithet} of {c.faction}
                    <Tools
                      locked={locked.has(key)}
                      onToggle={() => onToggleLock(key)}
                      onReroll={() => onReroll(0, key)}
                      label={`Player ${i + 1}`}
                    />
                  </dd>
                </React.Fragment>
              );
            })}
            {cast.enemies.map((c, i) => {
              const key = castLockKey("enemy", i);
              return (
                <React.Fragment key={key}>
                  <dt>Enemy {i + 1}</dt>
                  <dd>
                    <HeroLink name={c.hero} /> of {c.faction}
                    <Tools
                      locked={locked.has(key)}
                      onToggle={() => onToggleLock(key)}
                      onReroll={() => onReroll(0, key)}
                      label={`Enemy ${i + 1}`}
                    />
                    <br />
                    <span className="castSpeciality">{speciality(c.hero)}</span>
                  </dd>
                </React.Fragment>
              );
            })}
          </dl>
        </section>

        <section className="sheetSection">
          <h2>How to play</h2>
          <p className="line fixed">
            Start at Act 1 and read everything except the completion part. Set up the
            map and your starting deck, then follow the completion instructions once
            you meet the victory condition. Each Act says which Act follows it.
          </p>
          {CAMPAIGN_RULES.map((rule) => (
            <p className="line fixed" key={rule}>
              {rule}
            </p>
          ))}
          {campaign.mode === "coop" && (
            <>
              <p className="line fixed">
                Each Act offers two completion rewards, one per player. Agree between
                you who takes which before claiming them — you may not both take the
                same reward.
              </p>
              <p className="line fixed">
                Players may exchange Artifacts and Spells from their hands, as well as
                Units and Resources, if their Main Heroes are standing on adjacent
                Fields or both are standing in their own Town or Settlement.
              </p>
              <p className="line fixed">
                Standing on a Trading Post, Town or Settlement, a player may send
                Resources to any other player.
              </p>
            </>
          )}
        </section>
      </Sheet>

      {campaign.acts.map((act) => (
        <Sheet key={act.act} className="actSheet">
          <header className="sheetHeader compact">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="headerFrame" src={asset("/layout/section_heading.webp")} alt="" />
            <div className="sheetTitles">
              <h1 className="sheetTitle">Act {act.act}</h1>
            </div>
          </header>

          {story(act) && (
            <p className="storyLede">
              <GameText text={story(act)} />
            </p>
          )}

          <div className="sheetBody actBody">
            {buildSections(act).map((section) => (
              <section className="sheetSection" key={section.id}>
                <h2>{section.heading}</h2>
                {section.note && <p className="sectionNote">{section.note}</p>}
                {section.lines.map(({ field, display, label }) => {
                  const lockKey = `act${act.act}.${field.key}`;
                  return (
                    <p className={field.source ? "line" : "line fixed"} key={field.key}>
                      {display === "runIn" && <strong>{label}:</strong>}{" "}
                      <GameText text={field.text} />
                      {field.source && (
                        <Tools
                          locked={locked.has(lockKey)}
                          onToggle={() => onToggleLock(lockKey)}
                          onReroll={() => onReroll(act.act, field.key)}
                          label={field.label}
                        />
                      )}
                    </p>
                  );
                })}
              </section>
            ))}
          </div>

          {act.map && (
            <figure className="mapFigure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mapImage"
                src={asset(`/maps/campaign/${act.map}`)}
                alt={`Act ${act.act} map layout`}
              />
              <figcaption>
                Act {act.act} Map
                <Tools
                  locked={locked.has(`act${act.act}.map`)}
                  onToggle={() => onToggleLock(`act${act.act}.map`)}
                  onReroll={() => onReroll(act.act, "map")}
                  label="the map"
                />
              </figcaption>
            </figure>
          )}
        </Sheet>
      ))}
    </>
  );
}

