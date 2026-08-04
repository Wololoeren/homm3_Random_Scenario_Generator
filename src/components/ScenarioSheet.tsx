"use client";

import React from "react";
import GameText from "./GameText";
import { sheetSections } from "@/lib/presets";
import { asset } from "@/lib/assets";
import type { Field, Locks, Scenario } from "@/lib/types";

const MODE_LABEL = {
  coop: "Cooperative Scenario",
  clash: "Clash Scenario",
} as const;

interface Props {
  scenario: Scenario;
  locks: Locks;
  onToggleLock: (key: string) => void;
  onReroll: (key: string) => void;
}

function LockButton({
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
        title={
          locked ? `${label} is locked — click to unlock` : `Lock ${label}`
        }
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

export default function ScenarioSheet({
  scenario,
  locks,
  onToggleLock,
  onReroll,
}: Props) {
  const locked = new Set(locks);
  const byKey = new Map(scenario.fields.map((f) => [f.key, f]));
  const sections = sheetSections(scenario.mode, scenario.players);

  function line(field: Field, display: "runIn" | "prose", rollable: boolean) {
    return (
      <p className={rollable ? "line" : "line fixed"} key={field.key}>
        {display === "runIn" && <strong>{field.label}:</strong>}{" "}
        <GameText text={field.text} />
        {rollable && (
          <LockButton
            locked={locked.has(field.key)}
            onToggle={() => onToggleLock(field.key)}
            onReroll={() => onReroll(field.key)}
            label={field.label}
          />
        )}
      </p>
    );
  }

  return (
    <>
      <article className="sheet">
        {/* Page furniture as real images: browsers drop background graphics from
          printouts unless the user opts in. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pageTexture" src={asset("/layout/tausta.webp")} alt="" />

        <div className="sheetInner">
          <header className="sheetHeader">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="headerFrame"
              src={asset("/layout/section_heading.webp")}
              alt=""
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="sheetIcon"
              src={asset("/layout/random.webp")}
              alt=""
            />
            <div className="sheetTitles">
              <p className="sheetKicker">{MODE_LABEL[scenario.mode]}</p>
              <h1 className="sheetTitle">Random Scenario</h1>
              <p className="sheetSubtitle">{scenario.players} Players</p>
            </div>
          </header>

          <div className="sheetBody">
            {sections.map((section) => (
              <section className="sheetSection" key={section.id}>
                <h2>{section.heading}</h2>
                {section.note && <p className="sectionNote">{section.note}</p>}
                {section.fields.map((spec) => {
                  const field = byKey.get(spec.key);
                  if (!field) return null;
                  return line(field, spec.display, Boolean(spec.source));
                })}
              </section>
            ))}
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pageFooter" src={asset("/layout/bottom.webp")} alt="" />
        <span className="pageNumber" />
      </article>

      {/* The map gets a page of its own: sharing one with the text would
          shrink it below the point where tile positions can be read off it. */}
      <article className="sheet mapSheet">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pageTexture" src={asset("/layout/tausta.webp")} alt="" />

        <div className="sheetInner">
          <figure className="mapFigure">
            {scenario.map ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="mapImage"
                src={asset(`/maps/scenario/${scenario.map}`)}
                alt={`${scenario.players}-player map layout`}
              />
            ) : (
              <p className="line fixed">
                No map layouts left for this player count — re-enable some in
                Options.
              </p>
            )}
            <figcaption>
              {scenario.players}-Player Scenario
              <LockButton
                locked={locked.has("map")}
                onToggle={() => onToggleLock("map")}
                onReroll={() => onReroll("map")}
                label="the map"
              />
            </figcaption>
          </figure>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pageFooter" src={asset("/layout/bottom.webp")} alt="" />
        <span className="pageNumber" />
      </article>
    </>
  );
}
