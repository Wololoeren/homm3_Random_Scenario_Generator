import type { Cast, CampaignMode } from "./campaignTypes";

/**
 * The prose the spreadsheet builds with CONCATENATE, rewritten as templates.
 *
 * Only cells the extractor marks "formula" come through here, keyed
 * `<act>.<field>`. Anything without a template falls back to the sheet's last
 * cached value, so a missing entry degrades to stale text rather than nothing.
 *
 * Wording follows the sheets, with the same spelling and grammar fixes the
 * Data columns get.
 */

type Ctx = {
  cast: Cast;
  /** AI Hero Speciality, by hero name. */
  speciality: (hero: string) => string;
};

function names(cast: Cast) {
  const [e1, e2, e3] = cast.enemies;
  return { p1: cast.players[0], p2: cast.players[1], e1, e2, e3 };
}

type Template = (ctx: Ctx) => string;

const SHARED: Record<string, Template> = {
  "1.completionStory": ({ cast }) => {
    const { p1, e1, e2, e3 } = names(cast);
    return `${p1.hero} ${p1.epithet}, you must choose to go after ${e2.hero} (go to Act 2) OR ${e3.hero} (go to Act 3) to weaken ${e1.hero}'s position.`;
  },

  "2.story": ({ cast }) =>
    `${names(cast).e2.hero} is a backstabbing coward hiding behind tall walls, they must be eliminated before the reinforcements arrive!`,
  "2.victory": ({ cast }) => {
    const { e2 } = names(cast);
    return `Defeat the AI-faction-army of (${e2.faction}) controlled by ${e2.hero}.`;
  },
  "2.completionStory": ({ cast }) => {
    const { e1, e2 } = names(cast);
    return `With the defeat of ${e2.hero}'s army they flee in shame. You may follow them (go to Act 4) or take the fight to ${e1.hero} (go to Act 5).`;
  },

  "3.story": ({ cast }) =>
    `${names(cast).e3.hero} is a complete idiot — they are moving out to attack but have not realised the weather and terrain are working against them. They must be eliminated before they are at our gates.`,
  "3.victory": ({ cast }) => {
    const { e3 } = names(cast);
    return `Defeat the AI-faction-hero of (${e3.faction}) controlled by ${e3.hero}.`;
  },
  "3.completionStory": ({ cast }) => {
    const { e1, e3 } = names(cast);
    return `With the defeat of ${e3.hero}'s army they flee in shame. You may follow them (go to Act 4) or take the fight to ${e1.hero} (go to Act 6).`;
  },

  "4.story": ({ cast }) => {
    const { e2, e3 } = names(cast);
    return `${e2.hero} and ${e3.hero} met here, then fled through this cave. There is some ominous rumbling going on — they are casting an earthquake spell to collapse the cave. You must find your way out before you are buried alive!`;
  },
  "4.completionStory": ({ cast }) => {
    const { e2, e3 } = names(cast);
    return `You made it out just in time, but the cave has collapsed and ${e2.hero} and ${e3.hero} are nowhere to be found. Three portals are visible in a clearing: green (Act 5), yellow (Act 6) and red (Act 7). Which do you choose?`;
  },

  "5.story": ({ cast }) =>
    `As you and your army get settled in the new land it becomes clear this is ${names(cast).e1.hero}'s land — they have surely been stripped of building materials by now. Scouts report army reinforcements heading through these parts every week, so be prepared for an ambush!`,
  "5.timed": ({ cast }) =>
    `Spawn an AI faction hero (${names(cast).e1.faction}) on the center field of the center tile on round 2, 4 and 6.`,
  "5.completionStory": ({ cast }) =>
    `You surely dealt a vast blow to ${names(cast).e1.hero}, cutting them off from their reinforcements, though it was not without loss. We must continue the fight and press our advantage — go to Act 6.`,

  "6.story": ({ cast }) => {
    const { e2, e3 } = names(cast);
    return `Both ${e2.hero} and ${e3.hero} are licking their wounds. Now is the time to hit them where it hurts — capture their towns before they recover!`;
  },
  "6.completionStory": ({ cast }) => {
    const { e1, e2, e3 } = names(cast);
    return `${e2.hero} and ${e3.hero} are fleeing to their master ${e1.hero}. Follow them and finish this once and for all (go to Act 8).`;
  },

  "7.story": ({ cast }) =>
    `The red monolith was one way only — the ${cast.villains} baited you into a trap! Now you must fight the natives to survive.`,
  "7.completionStory": ({ cast }) => {
    const { e1, e2, e3 } = names(cast);
    return `The natives of this land now recognise you as their ruler, and show you a portal to the central part of ${e1.hero}, ${e2.hero} and ${e3.hero}'s kingdom. Now is the time to finish them once and for all (go to Act 8).`;
  },

  "8.story": ({ cast }) => {
    const { e1, e2, e3 } = names(cast);
    return `This is your final stand against ${e1.hero}, ${e2.hero} and ${e3.hero}. They will throw all their remaining forces against you to protect their last town. Make them regret they ever heard of you.`;
  },
  "8.timed": () =>
    "Roll an attack-die to spawn the corresponding AI faction hero on the center-field of their respective starting-tile on round 3, 6, 9, 12 and 14.",
};

/** The fixed opening of Act 1's briefing, before the enemy specialities. */
const ACT_ONE_RULES = [
  "The Starting tile must be your Faction's starting tile.",
  "Do not use Event cards for this campaign.",
  "Your buildings, income, units and secondary hero carry through the campaign unless otherwise specified.",
  "If your hero loses all units your campaign has failed and the game is over.",
  "If you do not fulfil the victory condition when the last round is over your campaign has failed and the game is over.",
  "Add the following AI behaviors when fighting each of the other faction leaders throughout the campaign:",
].join("\n");

function actOneInfo({ cast, speciality }: Ctx): string {
  const lines = cast.enemies.map((e) => `${e.hero}: ${speciality(e.hero)}`);
  return [ACT_ONE_RULES, ...lines].join("\n");
}

function actEightInfo(cast: Cast, marked: string): string {
  const [e1, e2, e3] = cast.enemies;
  return [
    `Your starting tile ${marked}`,
    `${e1.hero} with ${e1.faction} on 1.`,
    `${e2.hero} with ${e2.faction} on 0.`,
    `${e3.hero} with ${e3.faction} on -1.`,
    "Capturing a town stops armies spawning there (nothing happens when rolled).",
    "They are guarded by a faction army with a stack token on its silver units (no walls, no arrow towers).",
    "Conquering any of the center-tile level 7 field gives you 25G, then you may draw 5 Azure neutral units and buy any of them.",
  ].join("\n");
}

const SOLO: Record<string, Template> = {
  ...SHARED,
  "1.story": ({ cast }) => {
    const { p1, e1, e2, e3 } = names(cast);
    return `You are ${p1.hero} ${p1.epithet} of ${p1.faction}. Lately you have suffered great losses at the hand of your arch-rival ${e1.hero} from ${e1.faction}. Ever since they allied themselves with ${e2.hero} and ${e3.hero} it has been setback after setback. You must gather your strength and vanquish these ${cast.villains} before all is lost.`;
  },
  "1.actInfo": actOneInfo,
  "8.actInfo": ({ cast }) => actEightInfo(cast, 'is the one marked "H".'),
  "8.completion": ({ cast }) => {
    const { p1, e1, e2, e3 } = names(cast);
    return `Take a picture of your M&M deck and remaining units and post it on Discord with the description: “I, (#PlayerName) as ${p1.hero}, beat ${e1.hero}, ${e2.hero} and ${e3.hero} in Wolo's random solo campaign on #difficulty”.`;
  },
  "8.completionStory": ({ cast }) => {
    const { p1 } = names(cast);
    return `${p1.hero} ${p1.epithet}, you are victorious. The vast newly conquered kingdom will now live under your rule — congratulations!`;
  },
};

const COOP: Record<string, Template> = {
  ...SHARED,
  "1.story": ({ cast }) => {
    const { p1, p2, e1, e2, e3 } = names(cast);
    return `You are ${p1.hero} ${p1.epithet} of ${p1.faction} and ${p2?.hero} ${p2?.epithet} of ${p2?.faction}. Lately you and your ally have suffered great losses at the hand of your arch-rival ${e1.hero} from ${e1.faction}. Ever since they allied themselves with ${e2.hero} and ${e3.hero} it has been setback after setback. You must gather your strength and vanquish these ${cast.villains} before all is lost.`;
  },
  "1.actInfo": actOneInfo,
  "8.actInfo": ({ cast }) => actEightInfo(cast, `s are marked "H1" and "H2".`),
  "8.completion": ({ cast }) => {
    const { p1, p2, e1, e2, e3 } = names(cast);
    return `Take a picture of your M&M decks and remaining units and post it on Discord with the description: “I, (#Player1Name) and (#Player2Name) as ${p1.hero} and ${p2?.hero}, beat ${e1.hero}, ${e2.hero} and ${e3.hero} in Wolo's random coop campaign on #difficulty”.`;
  },
  "8.completionStory": ({ cast }) => {
    const { p1, p2 } = names(cast);
    return `${p1.hero} and ${p2?.hero}, you are victorious. The vast newly conquered kingdom will now live under your rule — congratulations!`;
  },
};

export function storyTemplate(
  mode: CampaignMode,
  act: number,
  field: string,
): Template | undefined {
  return (mode === "coop" ? COOP : SOLO)[`${act}.${field}`];
}
