# Contributing

Thanks for considering a patch. Bug fixes, a new layer, a new fact about a
place, a language: all welcome. The verification gate below is hard.

## Dev setup

Needs **Node 24 or newer**: the build scripts import the card's TypeScript
directly, which older versions cannot do.

```bash
git clone https://github.com/rolandzeiner/austria-map-card.git
cd austria-map-card
npm install
```

Day to day:

```bash
npm run dev          # rolldown watch: rebuilds dist/austria-map-card.js on save
npm run build        # one production build of the card
npm run build:data   # rebuilds the six data chunks from scripts/data/
npm run preview      # draws the map to PNG files in .cache/preview/
npm test
```

## Two builds, seven files

`dist/` holds everything a user installs, and it is committed:

| File | Written by | From |
| --- | --- | --- |
| `austria-map-card.js` | `npm run build` (Rolldown) | `src/` |
| `austria-map-data-*.js` (six) | `npm run build:data` | `scripts/data/*.gz` |

The card's file holds code only. A dashboard resource loads on every
dashboard, so the geometry lives in the six chunks and the card imports
each one the first time a layer or zoom level needs it.

Change `src/` and you rebuild the card. Change the data script, the
projection, the chunk format or an input, and you rebuild the data. CI
checks both against a fresh build.

## Verification gate (must pass before a PR)

```bash
npx tsc --noEmit                     # strict type-check: the only one in the pipeline
npm test                             # vitest
node scripts/build-data.mjs --check  # dist/austria-map-data-*.js match their inputs
npm run build                        # rolldown must succeed clean
git diff --exit-code -- dist/        # the committed dist/ matches that build
for f in dist/*.js; do node -c "$f"; done
```

Commit `dist/` with your change. HACS serves the committed files, so a
`src/` edit without a rebuild ships code that no longer matches its source.

CI runs the same steps plus `npm audit --omit=dev --audit-level=high`,
HACS validation and CodeQL.

## Looking at the map without a browser

`npm run preview` draws real frames with the card's own renderer through
`@napi-rs/canvas`: the whole country, a province, a municipal zoom, light
and dark. Look at them before you commit a change to drawing code or data.
The PNGs land in `.cache/preview/`, which git ignores. Add a scene to the
list in `scripts/preview.mjs` when you need another view.

`npm run preview -- --readme` also rewrites `screenshots/preview.webp`.

## Where things are

```
src/austria-map-card.ts   the element: events, template, wiring
src/config.ts             DEFAULTS, shared by the card and its editor
src/data/format.ts        the chunk format and its reader
src/data/arcs.ts          areas out of border arcs: hit test and outlines
src/layers/registry.ts    the list of layers
src/layers/loader.ts      loads chunks on demand
src/layers/store.ts       unpacked data
src/map/renderer.ts       draws a frame; no DOM beyond a 2D context
src/map/labels.ts         names and towns, one priority-ordered pass
src/map/camera.ts         map units and pixels
src/map/gestures.ts       pointers and keys, no DOM
scripts/build-data.mjs    downloads, reduces, builds the chunks
scripts/lib/              topology, terrain, rivers, places: pure functions
scripts/data/             the committed, reduced inputs
tests/                    the card's suites; scripts/lib/ has its own beside the code
```

### Adding a layer

A layer is one entry in `src/layers/registry.ts`: its id, an icon, the
chunks it needs at a scale, the scale from which it draws, and a `draw`
function. Add the id to `LAYER_IDS` in `src/types.ts` and a name under
`layers` in both language files. The loader, the layer list on the map
and the editor read the registry, so there is nothing else to wire.

### Adding a fact about a place

Population is one column of a table. Another fact (area, altitude) is
another column: add it to the table in `scripts/build-data.mjs` with a
`key`, a `label` translation key and its `source`, add the label under
`facts` in both language files, and rebuild the data. The info panel
shows whatever columns a table carries. River and road sets carry facts
the same way, one value per river name or route (their length). A value
prints as a plain number (`integer`), in metres (`metres`), or in
kilometres from tenths of a kilometre (`kilometres`).

### Changing the chunk format

Bump `DATA_FORMAT` in `src/data/format.ts` whenever a chunk's shape or
packing changes. A browser can hold a new card and an old chunk at once;
the loader refuses a chunk in another format and asks for a reload
instead of drawing it.

## Refreshing the data

The build reads only `scripts/data/*.gz`, so it needs no network. To move
to a newer release of a source, change its URL and date at the top of
`scripts/build-data.mjs`, then:

```bash
node scripts/build-data.mjs --refresh-borders      # BEV, 3 MB
node scripts/build-data.mjs --refresh-terrain      # BEV, 1.5 MB
node scripts/build-data.mjs --refresh-rivers       # BMLUK, 59 MB
node scripts/build-data.mjs --refresh-places       # BEV, 58 MB
node scripts/build-data.mjs --refresh-population   # Statistik Austria, 18 MB
node scripts/build-data.mjs --refresh              # all five
```

Downloads are kept in `.cache/` (ignored by git); add `--download` to
fetch one again. Rivers and places are cut against the borders, so refresh
those after the borders. The build fails if the borders and the
population table do not list the same municipalities.

`node scripts/build-data.mjs --measure` prints the chunk sizes for a range
of tolerances. The tables in the script's comments come from it; update
them when you change a setting.

## Tests

The suites are in `tests/` and beside the code in `scripts/lib/` (vitest,
no config file). Those that need a DOM opt in with an
`@vitest-environment happy-dom` docblock; the rest run in plain node.

- `scripts/lib/*.test.ts`: the build's pure functions.
- `tests/data.test.ts`: the committed chunks, read through the card's own
  reader. It checks, among other things, that all 2,092 municipal label
  points hit-test back to their municipality.
- `tests/renderer.test.ts`: the renderer on a recording canvas
  (`tests/fake-canvas.ts`): draw order, tile culling, detail by scale,
  the hit test.
- `tests/card.test.ts`, `tests/card-failures.test.ts`: the element in
  happy-dom, set up by `tests/card-harness.ts`. The failure states have
  their own file because the page has one loader, and a chunk it refused
  stays refused.
- `tests/editor.test.ts`, `tests/editor-defaults.test.ts`: the editor
  shows the real defaults and saves only what changed.

A change to what the card does should come with a test that fails
without it. `npm run test:coverage` prints a summary and writes
`coverage/coverage-final.json` (ignored by git).

## Branching

- All work happens on `dev`. PRs target `dev`.
- The maintainer cuts releases from `main` after a PR from `dev` to `main`.
- Don't force-push or commit directly to `main`.

## Releases

A release carries seven assets, not one: `.github/workflows/release.yml`
attaches every `dist/*.js`. HACS downloads exactly the assets of a
release, so one that carried only the card would install a map with no
data. The workflow also refuses a tag that differs from `package.json`'s
version; keep that and `CARD_VERSION` in `src/const.ts` equal
(`tests/i18n.test.ts` checks).

## Translations

1. Add `<code>.json` beside `src/localize/languages/en.json`, with the
   same keys.
2. Register it in `src/localize/localize.ts`: import it and add an entry
   to `LANGUAGE_REGISTRY`.
3. `npm test`: `tests/i18n.test.ts` compares keys and placeholders with
   English.

Missing keys fall back to English. German uses "du", never "Sie".

## Card build

The bundle is built by **Rolldown** (`rolldown.config.mjs`), which
transpiles, minifies and resolves modules natively: no plugins. Three
things in that config fail silently if you change them:

- The banner must be a **legal** comment, `/*! ... */`, with
  `comments: { legal: true }`. The minifier strips a `//` banner without a
  word.
- **`dropConsole` stays `false`.** It is all-or-nothing, and the card's
  console calls sit in `catch` blocks.
- **`codeSplitting` stays `false`.** The card is one file. The data
  chunks are not part of Rolldown's graph: their URL is worked out at run
  time from `import.meta.url`.

Rolldown does not type-check. `npx tsc --noEmit` is the only thing
between a type error and a green build.

## Style

- TypeScript strict; the `tsconfig.json` flags are not negotiable.
- Imports carry their `.ts` extension. The build scripts load the same
  files through Node, which needs it. For the same reason, files under
  `src/data/`, `src/layers/` and `src/map/` use no enums, no parameter
  properties and no decorators.
- No new runtime dependencies without discussion. The card has one
  (`lit`).
- Comments say why, not what.
