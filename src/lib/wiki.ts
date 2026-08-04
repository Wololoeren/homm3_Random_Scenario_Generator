/**
 * Links from a hero to their page on the community wiki.
 *
 * The slug is the name lowercased with the bracketed Faction folded in:
 * "Adelaide" → adelaide, "Tarnum (Fortress)" → tarnum_fortress. All 64 heroes
 * were checked against the live wiki; the one below is the only name whose
 * page carries a Faction suffix the spreadsheet does not.
 */

const BASE = "https://en.homm3bg.wiki/heroes";

const SLUG_OVERRIDES: Record<string, string> = {
  // The wiki disambiguates both Lord Haarts; the sheet only marks the second.
  "Lord Haart": "lord_haart_castle",
};

export function heroSlug(name: string): string {
  return (
    SLUG_OVERRIDES[name] ??
    name
      .toLowerCase()
      .replace(/[()]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

export function heroWikiUrl(name: string): string {
  return `${BASE}/${heroSlug(name)}/`;
}
