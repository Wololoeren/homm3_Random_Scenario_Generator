"use client";

import React, { useState } from "react";
import GameText from "./GameText";
import { mapPool, scenarioData } from "@/lib/generate";
import { campaignData, campaignMapPool, HERO_KEY } from "@/lib/campaign";
import { setColumnDisabled, toggleDisabled } from "@/lib/settings";
import { asset } from "@/lib/assets";
import type { Disabled, Mode, PlayerCount } from "@/lib/types";
import type { CampaignMode } from "@/lib/campaignTypes";

const MODES: { id: Mode; label: string }[] = [
  { id: "coop", label: "Coop" },
  { id: "clash", label: "Clash" },
];
const COUNTS: PlayerCount[] = [2, 3, 4, 5, 6];

const CAMPAIGN_MODES: { id: CampaignMode; label: string }[] = [
  { id: "solo", label: "Solo" },
  { id: "coop", label: "Two players" },
];

/** Which Acts draw from each campaign map column. */
const CAMPAIGN_MAP_COLUMNS: { id: string; label: string }[] = [
  { id: "A", label: "Act 1" },
  { id: "B", label: "Acts 2–3" },
  { id: "C", label: "Act 4" },
  { id: "D", label: "Act 5" },
  { id: "E", label: "Act 6" },
  { id: "F", label: "Act 7" },
  { id: "G", label: "Act 8" },
];

interface Props {
  disabled: Disabled;
  onChange: (next: Disabled) => void;
}

function Section({
  title,
  count,
  total,
  children,
  onAll,
  onNone,
}: {
  title: string;
  count: number;
  total: number;
  children: React.ReactNode;
  onAll: () => void;
  onNone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="optionSection">
      <header>
        <button type="button" className="sectionToggle" onClick={() => setOpen(!open)}>
          <span className="chevron">{open ? "▾" : "▸"}</span>
          {title}
          <span className={count === 0 ? "countBadge empty" : "countBadge"}>
            {count} / {total}
          </span>
        </button>
        <span className="sectionActions">
          <button type="button" className="linkButton" onClick={onAll}>
            All
          </button>
          <button type="button" className="linkButton" onClick={onNone}>
            None
          </button>
        </span>
      </header>
      {count === 0 && (
        <p className="warning">
          Everything here is switched off — this line will print as “—”.
        </p>
      )}
      {open && children}
    </section>
  );
}

/** A collapsible list of on/off entries backed by one key in the settings. */
function EntrySection({
  title,
  storageKey,
  entries,
  disabled,
  onChange,
  render,
  wide,
}: {
  title: string;
  storageKey: string;
  entries: { id: string; text: string }[];
  disabled: Disabled;
  onChange: (next: Disabled) => void;
  render?: (text: string) => React.ReactNode;
  /** One entry per row, for entries that carry a second line of detail. */
  wide?: boolean;
}) {
  const off = disabled[storageKey] ?? [];
  return (
    <Section
      title={title}
      count={entries.length - entries.filter((e) => off.includes(e.id)).length}
      total={entries.length}
      onAll={() =>
        onChange(
          setColumnDisabled(
            disabled,
            storageKey,
            off.filter((id) => !entries.some((e) => e.id === id)),
          ),
        )
      }
      onNone={() =>
        onChange(
          setColumnDisabled(disabled, storageKey, [
            ...off.filter((id) => !entries.some((e) => e.id === id)),
            ...entries.map((e) => e.id),
          ]),
        )
      }
    >
      <ul className={wide ? "entryList wide" : "entryList"}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <label>
              <input
                type="checkbox"
                checked={!off.includes(entry.id)}
                onChange={() => onChange(toggleDisabled(disabled, storageKey, entry.id))}
              />
              <span>{render ? render(entry.text) : <GameText text={entry.text} />}</span>
            </label>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Thumbnail grid of map layouts, toggled one at a time. */
function MapGallery({
  names,
  folder,
  disabled,
  onChange,
  filters,
}: {
  names: string[];
  folder: string;
  disabled: Disabled;
  onChange: (next: Disabled) => void;
  filters: React.ReactNode;
}) {
  const off = disabled.map ?? [];
  const on = names.filter((m) => !off.includes(m)).length;

  /** Only touches the maps currently on screen. */
  function setAll(enabled: boolean) {
    const inView = new Set(names);
    const kept = off.filter((name) => !inView.has(name));
    onChange(setColumnDisabled(disabled, "map", enabled ? kept : [...kept, ...names]));
  }

  return (
    <>
      <div className="mapFilters">
        {filters}
        <span className={on === 0 ? "countBadge empty" : "countBadge"}>
          {on} / {names.length}
        </span>
        <span className="sectionActions">
          <button type="button" className="linkButton" onClick={() => setAll(true)}>
            All
          </button>
          <button type="button" className="linkButton" onClick={() => setAll(false)}>
            None
          </button>
        </span>
      </div>

      <ul className="mapGrid">
        {names.map((name) => {
          const enabled = !off.includes(name);
          return (
            <li key={name}>
              <button
                type="button"
                className={enabled ? "mapCard" : "mapCard off"}
                onClick={() => onChange(toggleDisabled(disabled, "map", name))}
                aria-pressed={enabled}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(`/maps/${folder}/${name}`)} alt="" loading="lazy" />
                <span className="mapCheck">{enabled ? "✔" : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {names.length === 0 && (
        <p className="warning">No layouts recorded for this combination.</p>
      )}
    </>
  );
}

function ScenarioOptions({ disabled, onChange }: Props) {
  const [mapMode, setMapMode] = useState<Mode>("coop");
  const [mapPlayers, setMapPlayers] = useState<PlayerCount>(4);

  return (
    <>
      <h2 className="optionsHeading">Random tables</h2>
      {scenarioData.columns.map((column) => (
        <EntrySection
          key={column.id}
          title={column.label}
          storageKey={column.id}
          entries={column.entries}
          disabled={disabled}
          onChange={onChange}
        />
      ))}

      <h2 className="optionsHeading">Map layouts</h2>
      <MapGallery
        names={mapPool(mapMode, mapPlayers)}
        folder="scenario"
        disabled={disabled}
        onChange={onChange}
        filters={
          <>
            <div className="segmented">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={mapMode === m.id ? "active" : ""}
                  onClick={() => setMapMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="segmented">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={mapPlayers === c ? "active" : ""}
                  onClick={() => setMapPlayers(c)}
                >
                  {c}P
                </button>
              ))}
            </div>
          </>
        }
      />
    </>
  );
}

function CampaignOptions({ disabled, onChange }: Props) {
  const [mapMode, setMapMode] = useState<CampaignMode>("solo");
  const [mapColumn, setMapColumn] = useState("A");
  const heroes = campaignData.reference.heroes;
  const specialities = campaignData.reference.specialities;

  return (
    <>
      <h2 className="optionsHeading">Random tables</h2>
      {campaignData.columns.map((column) => (
        <EntrySection
          key={column.id}
          title={column.label}
          storageKey={`campaign.${column.id}`}
          entries={column.entries}
          disabled={disabled}
          onChange={onChange}
        />
      ))}

      <h2 className="optionsHeading">Heroes</h2>
      <p className="lede">
        Switching a Faction’s heroes all off takes that Faction out of the cast — no
        two leaders can share one, so there would be nobody left to lead it.
      </p>
      {Object.entries(heroes).map(([faction, names]) => (
        <EntrySection
          key={faction}
          title={faction}
          storageKey={HERO_KEY}
          entries={names.map((name) => ({ id: name, text: name }))}
          disabled={disabled}
          onChange={onChange}
          wide
          render={(name) => (
            <>
              <span className="heroName">{name}</span>
              <span className="heroSpeciality">{specialities[name]}</span>
            </>
          )}
        />
      ))}

      <h2 className="optionsHeading">Map layouts</h2>
      <MapGallery
        names={campaignMapPool(mapMode, mapColumn)}
        folder="campaign"
        disabled={disabled}
        onChange={onChange}
        filters={
          <>
            <div className="segmented">
              {CAMPAIGN_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={mapMode === m.id ? "active" : ""}
                  onClick={() => setMapMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="segmented">
              {CAMPAIGN_MAP_COLUMNS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={mapColumn === c.id ? "active" : ""}
                  onClick={() => setMapColumn(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        }
      />
    </>
  );
}

export default function OptionsTab({ disabled, onChange }: Props) {
  const [view, setView] = useState<"scenario" | "campaign">("scenario");

  return (
    <div className="options">
      <div className="optionsNav">
        <div className="segmented">
          <button
            type="button"
            className={view === "scenario" ? "active" : ""}
            onClick={() => setView("scenario")}
          >
            Scenarios
          </button>
          <button
            type="button"
            className={view === "campaign" ? "active" : ""}
            onClick={() => setView("campaign")}
          >
            Campaigns
          </button>
        </div>
      </div>

      <p className="lede">
        Switch off anything you don’t own or don’t want to see. Choices are kept in
        this browser and apply to everything you generate.
      </p>

      {view === "scenario" ? (
        <ScenarioOptions disabled={disabled} onChange={onChange} />
      ) : (
        <CampaignOptions disabled={disabled} onChange={onChange} />
      )}
    </div>
  );
}
