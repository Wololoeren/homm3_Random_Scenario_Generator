"use client";

import { useEffect, useState } from "react";
import ScenarioSheet from "@/components/ScenarioSheet";
import CampaignSheet from "@/components/CampaignSheet";
import ReferenceSheet from "@/components/ReferenceSheet";
import OptionsTab from "@/components/OptionsTab";
import { DarkBackgroundContext, MonochromeContext } from "@/components/UnitGlyphs";
import { generate, rerollField } from "@/lib/generate";
import {
  generateCampaign,
  rerollCampaignField,
  rerollCastMember,
} from "@/lib/campaign";
import type { Campaign, CampaignMode } from "@/lib/campaignTypes";
import { emptySettings, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import type { Disabled, Mode, PlayerCount, Scenario } from "@/lib/types";

/** Scenario modes take a player count; campaigns come in solo and coop. */
const MODES: { id: AnyMode; label: string }[] = [
  { id: "coop", label: "Coop" },
  { id: "clash", label: "Clash" },
  { id: "solo", label: "Campaign (1P)" },
  { id: "coopCampaign", label: "Campaign (2P)" },
];
const COUNTS: PlayerCount[] = [2, 3, 4, 5, 6];
type Tab = "scenario" | "options" | "reference";
type AnyMode = Mode | "solo" | "coopCampaign";

function campaignModeOf(mode: AnyMode): CampaignMode | null {
  if (mode === "solo") return "solo";
  if (mode === "coopCampaign") return "coop";
  return null;
}

export default function Page() {
  const [mode, setMode] = useState<AnyMode>("coop");
  const [players, setPlayers] = useState<PlayerCount>(4);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [locks, setLocks] = useState<string[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<Tab>("scenario");

  const campaignMode = campaignModeOf(mode);

  // Settings live in localStorage, so the first roll waits for the client.
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setScenario(generate("coop", 4, loaded.disabled));
  }, []);

  function update(patch: Partial<Settings>) {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }

  function updateDisabled(disabled: Disabled) {
    update({ disabled });
  }

  function roll(nextMode: AnyMode, nextPlayers: PlayerCount, keepLocks: boolean) {
    const asCampaign = campaignModeOf(nextMode);
    if (asCampaign) {
      setCampaign((current) =>
        generateCampaign(
          asCampaign,
          settings.disabled,
          keepLocks ? locks : [],
          current ?? undefined,
        ),
      );
      return;
    }
    setScenario((current) =>
      generate(
        nextMode as Mode,
        nextPlayers,
        settings.disabled,
        keepLocks ? locks : [],
        current ?? undefined,
      ),
    );
  }

  function changeMode(next: AnyMode) {
    setMode(next);
    // Every mode draws from a different shape of sheet, so a switch starts fresh.
    setLocks([]);
    roll(next, players, false);
  }

  function changePlayers(next: PlayerCount) {
    setPlayers(next);
    // The map pool is per player count; anything else may stay pinned.
    setLocks((current) => current.filter((key) => key !== "map"));
    roll(mode, next, true);
  }

  function toggleLock(key: string) {
    setLocks((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }

  function reroll(key: string) {
    setScenario((current) => (current ? rerollField(current, key, settings.disabled) : current));
  }

  function rerollAct(act: number, key: string) {
    if (key.startsWith("cast.")) {
      setCampaign((current) =>
        current ? rerollCastMember(current, key, settings.disabled) : current,
      );
      return;
    }
    setCampaign((current) =>
      current ? rerollCampaignField(current, act, key, settings.disabled) : current,
    );
  }

  return (
    <div className="app">
      <header className="topBar no-print">
        <div className="brand">
          <h1>Random Scenario Generator</h1>
          <p>Heroes of Might &amp; Magic III: The Board Game</p>
        </div>
        <nav className="tabs">
          {(["scenario", "options", "reference"] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {id === "scenario"
                ? campaignMode
                  ? "Campaign"
                  : "Scenario"
                : id === "options"
                  ? "Options"
                  : "Reference"}
            </button>
          ))}
        </nav>
      </header>

      <div className="controls no-print">
        <div className="controlGroup">
          <span className="controlLabel">Type</span>
          <div className="segmented">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={mode === m.id ? "active" : ""}
                onClick={() => changeMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Campaigns fix their own player count, so the picker only applies
            to scenarios. */}
        {!campaignMode && (
          <div className="controlGroup">
            <span className="controlLabel">Players</span>
            <div className="segmented">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={players === c ? "active" : ""}
                  onClick={() => changePlayers(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="controlGroup grow">
          <button type="button" className="primary" onClick={() => roll(mode, players, true)}>
            Roll unlocked
          </button>
          <button
            type="button"
            onClick={() => {
              setLocks([]);
              roll(mode, players, false);
            }}
          >
            Roll everything
          </button>
          <button type="button" onClick={() => setLocks([])} disabled={locks.length === 0}>
            Clear {locks.length} lock{locks.length === 1 ? "" : "s"}
          </button>
          <button
            type="button"
            className={settings.economy ? "toggle on" : "toggle"}
            aria-pressed={settings.economy}
            onClick={() => update({ economy: !settings.economy })}
            title="Drop the parchment, artwork and colour so a printout uses far less ink"
          >
            🖨 Ink saver{settings.economy ? ": on" : ""}
          </button>
          <button type="button" className="primary" onClick={() => window.print()}>
            Save as PDF
          </button>
        </div>
      </div>

      <MonochromeContext.Provider value={settings.economy}>
        <main className={settings.economy ? "printRoot economy" : "printRoot"}>
          <div className={tab === "scenario" ? "pane" : "pane screenHidden"}>
            {campaignMode ? (
              campaign ? (
                <CampaignSheet
                  campaign={campaign}
                  locks={locks}
                  onToggleLock={toggleLock}
                  onReroll={rerollAct}
                />
              ) : (
                <p className="lede">Rolling…</p>
              )
            ) : scenario ? (
              <ScenarioSheet
                scenario={scenario}
                locks={locks}
                onToggleLock={toggleLock}
                onReroll={reroll}
              />
            ) : (
              <p className="lede">Rolling…</p>
            )}
          </div>

          <div
            className={tab === "options" ? "pane neverPrint" : "pane screenHidden neverPrint"}
          >
            {/* Options is app chrome, not a printed sheet — it keeps its
                colour icons even while ink saver is on. */}
            <MonochromeContext.Provider value={false}>
              <DarkBackgroundContext.Provider value={true}>
                <OptionsTab disabled={settings.disabled} onChange={updateDisabled} />
              </DarkBackgroundContext.Provider>
            </MonochromeContext.Provider>
          </div>

          <div className={tab === "reference" ? "pane" : "pane screenHidden"}>
            <ReferenceSheet coop={mode !== "clash"} />
          </div>
        </main>
      </MonochromeContext.Provider>

      <footer className="siteFooter no-print">
        <p>
          Fan-made tool. Tables and map layouts come from Wololoeren’s random scenario
          spreadsheets; styling and icons from the{" "}
          <a href="https://github.com/qwrtln/Homm3BG-mission-book">Fan-Made Mission Book</a>.
          Not affiliated with Ubisoft or Archon Studio.
        </p>
      </footer>
    </div>
  );
}
