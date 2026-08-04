<div align="center">
  <h1>Heroes of Might & Magic III: The Board Game<br>Random Scenario Generator</h1>
</div>

## About

Rolls a random cooperative or clash scenario for 2–6 players and prints it as a
PDF laid out like a page from the [Fan-Made Mission Book][mission-book].

It is a web version of Wololoeren's random scenario spreadsheets:

- [Random scenarios (coop & clash)][sheet-scenario]
- [Random campaigns (solo & two players)][sheet-campaign]

Fan-made, not affiliated with Ubisoft or Archon Studio.

## Using it

- **Type / Players** — pick coop or clash and a player count, or one of the two
  campaigns. Each changes which pools are rolled: clash draws its victory
  condition from a different column and has no AI behaviour block, and every
  player count has its own map pool.
- **Hero links** — every name on the campaign cast page links to that hero on
  [the community wiki](https://en.homm3bg.wiki/heroes/), and the link survives
  into the printed PDF. Slugs are derived in `src/lib/wiki.ts`; all 64 were
  checked against the live site.
- **Campaigns** roll a cast of five faction leaders (all different factions, as
  the sheet's `UNIQUE` enforces) and then eight Acts built around them. The
  story, briefings and victory conditions that the spreadsheet assembles with
  `CONCATENATE` live in `src/lib/campaignStory.ts` as templates; everything else
  is either fixed text or a roll, as recorded per field by the extractor.
- **🔒 / 🎲** — lock a line to keep it through the next roll, or reroll that one
  line on its own. *Roll unlocked* respects locks; *Roll everything* ignores them.
- **Options** — switch off any table entry, hero or map layout you don't own or
  don't want, under **Scenarios** or **Campaigns**. Saved in the browser and
  applied to every roll. Switching all of a Faction's heroes off takes that
  Faction out of the campaign cast entirely, since no two leaders may share one.
- **Ink saver** — drops the parchment, the banner and footer artwork and the
  colour, swaps the tier stars for the Mission Book's monochrome versions and
  inverts the dark map tiles to pale ones. Much cheaper to print, same content.
- **Save as PDF** — prints the scenario sheet plus the reference pages (enemy
  stacks, AI army composition, AI rules, glossary). Use your browser's
  "Save as PDF" destination; A4 portrait is set by the stylesheet.

Print builds real pages. Each `.sheet` is exactly A4 and carries its own
parchment, banner and footer bar as ordinary positioned images — a browser
paints a `position: fixed` element on the first printed page only, so per-page
furniture has to come from per-page elements. That is why the reference is
split into four `<Page>` blocks rather than left to flow, and why the map has a
sheet of its own.

**Anything added to a sheet has to fit its page**, since the print rules give
each one `height: 297mm; overflow: hidden`. Current headroom: the scenario text
page measures 256mm with every rolled line at its longest entry at once, the
four reference pages sit at 231 / 260 / 151 / 207mm, and the worst campaign Act
page is about 285mm.

Page numbers come from a CSS counter over `.sheet`, so they need no wiring.
Note that a hidden tab does not increment it — on screen each tab numbers from
1, while a printout numbers straight through.

### Army shorthand

The spreadsheets write armies two ways, and both render as tier stars:

| Written | Means | Shown as |
| --- | --- | --- |
| `2B`, `1S`, `3G`, `1A` | a count of Bronze / Silver / Gold / Azure units | the count and that tier's star |
| `2Bs`, `1Gs` | the same, carrying a stack token | a doubled, overlapping star |
| `T1F`, `T5F` | a faction tier, Few | that tier's star with the number on it |
| `T1P`, `T2-6P` | a faction tier (or range), Packed | the same, doubled for the packed look |

Tiers map to colours as the glossary sets out — 1–3 Bronze, 4–5 Silver, 6–7
Gold. A range that crosses colours (`T2-6P`) takes the star of its highest tier.

Resources are iconised in every form the sheets write them — `10G`, `10 gold`,
`gold income`, `BM`, `building materials`, `V`, `valuables` — as are the two
dice, `MP`/`XP`, `Tier 1` and `Tier 3-7`, `2xB` (two Bronze Units, drawn as two
stars) and the spell, artifact and experience icons. Camp, Workshop, City Hall,
Mage Guild and Citadel get their building glyph in front of the name.

A bare noun keeps its word when it opens a sentence — "Artifacts cannot be
obtained…" rather than an icon with nothing in front of it. Case carries meaning and is respected: capitalised `Gold` is the unit
tier, lower-case `gold` the resource, except in "gold Dwelling" where it is the
tier again.

Scenario prose deliberately does *not* get the counted form: there `5G` means
five gold, not five Gold units.

Each army in the AI-army tables also carries 0–3 skill glyphs, giving the number
of AI behaviours it fights with. The spreadsheet stores that as the cell's fill
colour rather than as text — green none, yellow one, orange two, red three — so
`extract_tables.py` reads the colours back out into a `behaviours` grid
alongside `rows`. **Recolouring those cells in the sheet changes the printed
output**, so keep the four fills exactly as they are.

## Development

```bash
npm install
npm run dev
```

`npm run build` produces a static export in `out/`. The GitHub Pages workflow
builds with `NEXT_BASE_PATH` set to the repository name so assets resolve under
`https://<user>.github.io/<repo>/`.

### Updating the data

Everything the generator rolls on is extracted from the two spreadsheets into
`src/data/`. To pick up edits made in Google Sheets:

```bash
curl -L -o scen.xlsx "https://docs.google.com/spreadsheets/d/1c5c_WXMjv8XpsxHYxU0E3TOmgcL-b99uymwkoIaz7bA/export?format=xlsx"
curl -L -o camp.xlsx "https://docs.google.com/spreadsheets/d/18mrSsAszQcfTLYc97Hg-IHLIAkuIUoBMJJDNgVf9jTw/export?format=xlsx"
python tools/extract_tables.py scen.xlsx camp.xlsx
python tools/extract_maps.py scen.xlsx camp.xlsx
```

`tools/optimise_assets.py` re-encodes the page furniture copied in from the
other repos: the layout art becomes WebP at the size it is actually drawn, and
the fonts become WOFF2. Run it after copying anything new into `public/layout`
or `public/fonts`. Only the glyphs the code actually asks for are kept — see
the maps in `GameText.tsx` and `UnitGlyphs.tsx` before deleting more.

`extract_tables.py` writes `src/data/scenario.json` and `src/data/campaign.json`
(the Data columns plus the Stack / AI-army / AI / Glossary tabs).
`extract_maps.py` pulls the in-cell map images out of `xl/media`, works out which
column each belongs to from the drawing anchors, drops duplicates and re-encodes
them to WebP in `public/maps/`. Both need `openpyxl`; the map script also needs
`pillow`.

Entry ids are derived from the entry text, so rewording an option resets whether
a user had it switched off. Adding, removing and reordering entries is safe.

`extract_tables.py` also applies a `CORRECTIONS` list to every entry as it is
read. Currently it rewrites **Capital → Citadel**: the spreadsheets name the
building "Capital", but the board game has no such building. Fixing it at
extraction keeps the correction in one place and survives re-running the script.

## Credits

- Scenario, campaign and map tables: **Wololoeren**
- Layout, fonts, icons and artwork: [Fan-Made Mission Book][mission-book]
  and the [Rewritten Rule Book](https://github.com/Heegu-sama/Homm3BG)

[mission-book]: https://github.com/qwrtln/Homm3BG-mission-book
[sheet-scenario]: https://docs.google.com/spreadsheets/d/1c5c_WXMjv8XpsxHYxU0E3TOmgcL-b99uymwkoIaz7bA/edit
[sheet-campaign]: https://docs.google.com/spreadsheets/d/18mrSsAszQcfTLYc97Hg-IHLIAkuIUoBMJJDNgVf9jTw/edit
