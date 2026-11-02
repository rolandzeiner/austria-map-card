# Contributing to Austria Map Card

Thanks for taking a look. This repo is a Lovelace card for Home Assistant. Everything you need to work on it is on this page, and the gate in *Verification gate* has to pass before a change lands.

## Quick start

```bash
git clone https://github.com/rolandzeiner/austria-map-card.git
cd austria-map-card
npm ci && npm run build
```

Before a PR, run the gate in *Verification gate*. It is what CI runs, so failing locally only costs you a push.

## Branching and releases

- Work on `dev`; PRs target `dev`. Nothing is committed or force-pushed to `main`.
- For anything bigger than a fix, open an issue first so the shape is agreed before the code is written.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. A subject line, then bullets that say what changed and why.
- The built bundle is committed and travels with the `src/` change that produced it: users install through the Marketplace and never run `npm`, and CI fails when the committed bundle differs from a fresh build by a byte.
- Releases are the maintainer's: a `dev → main` PR, squash-merged, then a tag from `main`. Publishing the release runs `release.yml`, which attaches every `dist/*.js`: thirteen assets, not one (see *Two builds, thirteen files*). The Marketplace downloads exactly the assets of a release, so one that carried only the card would install a map with no data. If the job fails, `gh workflow run release.yml -f tag=vX.Y.Z` re-runs it against the existing tag. The workflow refuses a tag that disagrees with `package.json`.
- Contributions are accepted under the repo's MIT licence.

## Card toolchain

The card lives in `src/` and builds to `dist/austria-map-card.js`. Its whole toolchain runs through [Vite+](https://viteplus.dev/) (`vp`), configured in `vite.config.ts`: `vp build` (Vite library mode on Rolldown), `vp test` (Vitest) and `vp check` (Oxfmt, Oxlint and the type-check). The card `devDependencies` are `vite-plus`, `happy-dom` and `@napi-rs/canvas` (the preview renderer, see *Looking at the map without a browser*); Vitest, Rolldown and the type-checker ship inside `vite-plus`, and `typescript` is not installed. `npx vp` runs the copy in `node_modules`; a global `vp` works too.

| Command | What it does |
|---|---|
| `npm run dev` | `vp build --watch --mode development`: rebuilds `dist/austria-map-card.js` on save, unminified, with a sourcemap |
| `npm run build` | `vp build`: one-shot production build of the card, minified, no sourcemap |
| `npm run build:data` | rebuilds the twelve data chunks in `dist/` from `scripts/data/`, printing each chunk's size as written and gzipped |
| `npm run preview` | draws the map to PNG files in `.cache/preview/` |
| `npm test` | `vp test run`: every suite |
| `npm run check` | `vp check`: format, lint and the type-check |
| `npx vp check --fix` | the same, applying the formatter and the safe lint fixes |

Node 24.11 or newer (26 works too) and npm 11. The floor is that high because the build scripts import the card's TypeScript directly, which older Node versions cannot do.

Commit the built bundle. End users install through the Marketplace and never run `npm`, so `dist/austria-map-card.js` is tracked, and so are the twelve data chunks beside it. CI asserts the committed bundle matches a fresh build byte for byte and the chunks match their script. A dev build writes a `.map` file next to the bundle; it is gitignored.

Things in `vite.config.ts` that fail silently if you change them:

- The banner must be a **legal** comment, `/*! ... */`, with `comments: { legal: true }`. The minifier strips a `//` banner without a word; only the built file's first bytes show it.
- **`minify` lives on `rolldownOptions.output`, with `dropConsole: false`.** Vite's library mode skips whitespace minification for ES output, so `build.minify` alone ships the bundle with its whitespace left in. `dropConsole` is all-or-nothing, and the `console.*` calls here sit in `catch` blocks, where dropping them turns a caught error into a silent one.
- **Dev vs prod comes from `--mode development`** (`npm run dev`). A plain `vp build` is production: minified, no sourcemap.
- **`fmt.embeddedLanguageFormatting` stays `"off"`.** Otherwise Oxfmt reformats Lit `html` and `css` templates and changes the whitespace inside rendered elements, which is a DOM change, not a style change.
- **Decorators are not configured.** Rolldown reads `tsconfig.json` itself and enables Lit's legacy decorators from it. If that ever regresses, class fields overwrite Lit's accessors and reactivity dies while the build stays green; the suites that mount the real card catch it.
- **`lint.plugins` replaces Oxlint's defaults.** It names `typescript`, `unicorn` and `oxc` next to `vitest`; drop one and its rules stop running without a word. The `vitest/*` rules fail a committed `.only` or `.skip`, a test without an assertion, a duplicate title, an `expect` inside an `if` and a bare `toThrow()`, and `reportUnusedDisableDirectives` fails a disable comment that no longer suppresses anything.
- **`lint.options.denyWarnings: true`.** Without it `vp check` exits 0 on warnings, and CI lets them through.
- **`codeSplitting: false`.** The card is one file; a dashboard resource can't load a second chunk the bundler decided on. The data chunks are not in the bundler's graph; their URL is worked out at run time from `import.meta.url`.
- **`emptyOutDir: false`.** Vite empties the output directory before each build by default, and `dist/` also holds the twelve data chunks, which this build does not write.

**The `vite` override in `package.json` must name the same version as `vite-plus`.** It keeps npm from installing upstream Vite next to Vite+'s core. Dependabot bumps `vite-plus` but not the override, and `tests/toolchain.test.ts` fails until both match. Bump with `npx --package=vite-plus@<new> vp migrate --no-interactive`, which moves both; `npm install vite-plus@<new>` fails with ERESOLVE.

The build does not type-check. `vp check` is the only thing between a type error and a green build, which is why the gate runs it as its own step. It also catches a backtick inside a Lit `css` or `html` template, comments included, which ends the template early and fails the card at load while the build stays green.

`tsconfig.json`'s `lib` is the card's browser floor: `es2022`. That rules out ES2023 built-ins such as `toSorted()`, which the bundle doesn't polyfill; use `sorted()` from `src/sorted.ts`. The Node-only scripts may use them. Raising the floor raises the browser requirement for the card; change both together.

### Trying it in Home Assistant

Install the card through the Marketplace once so the Lovelace resource exists. Then copy the rebuilt `dist/*.js` files over the installed ones in `<config>/www/community/austria-map-card/`, delete every `.js.gz` beside them, and hard-refresh the browser (⌘⇧R / Ctrl⇧R). The Marketplace writes those gzipped copies on install and Home Assistant serves them first, so without the delete the browser keeps getting the old card.

## Verification gate

```bash
npx vp check                         # format, lint and the only type-check
npm test                             # vp test run
node scripts/build-data.mjs --check  # dist/austria-map-data-*.js match their inputs
npm run build                        # must succeed clean
git diff --exit-code -- dist/        # the committed dist/ matches that build
for f in dist/*.js; do node -c "$f"; done
```

CI runs the same plus `npm audit --omit=dev --audit-level=high`, HACS validation and CodeQL. Failing locally only costs you a push.

`npx vp check` is the only type-check anywhere. The build strips types without checking them, so a type error builds cleanly all the way to a shipped bundle.

## Tests

The suites are in `tests/` and beside the code in `scripts/lib/`, and import from `vite-plus/test`. Most run in plain Node; the suites that drive the element opt into happy-dom with an `@vitest-environment happy-dom` docblock and are set up by `tests/card-harness.ts`, with the canvas replaced by `tests/fake-canvas.ts`. happy-dom has no layout, no canvas and no WebGL, so drawing is tested as recorded calls and geometry as data. HA's own elements are never defined in tests, on purpose.

| Suite | Covers |
|---|---|
| `scripts/lib/*.test.ts` | the data build's pure functions: topology, terrain, rivers, roads, places, the chunk encoding |
| `tests/data.test.ts`, `tests/chunks.ts` | the committed chunks, read through the card's own reader; among other things, that every municipal label point hit-tests back to its municipality |
| `tests/store.test.ts`, `tests/loader.test.ts`, `tests/registry.test.ts` | unpacking, on-demand loading and the layer list |
| `tests/renderer.test.ts`, `tests/tiles.test.ts`, `tests/label-placer.test.ts`, `tests/relief-lines.test.ts`, `tests/relief-gl.test.ts`, `tests/view3d.test.ts` | drawing on a recording canvas: draw order, tile culling, detail by scale, labels, relief and the 3D view's geometry and shaders |
| `tests/camera.test.ts`, `tests/gestures.test.ts`, `tests/location.test.ts`, `tests/peaks.test.ts`, `tests/roads.test.ts`, `tests/info.test.ts`, `tests/palette.test.ts` | map units and pixels, pointers and keys, the pin, the hit test, the info panel's text and the colours |
| `tests/card.test.ts`, `tests/card-failures.test.ts`, `tests/card-tilt.test.ts`, `tests/card-location.test.ts` | the element in happy-dom. The failure states have their own file because the page has one loader, and a chunk it refused stays refused |
| `tests/editor.test.ts`, `tests/editor-defaults.test.ts`, `tests/editor-schema.test.ts` | the editor shows the real defaults, offers every option and saves only what changed |
| `tests/grid-cell.test.ts`, `tests/styles.test.ts`, `tests/bundle.test.ts` | the grid-cell fill, the stylesheet and what the built bundle must and must not contain |
| `tests/i18n.test.ts` | language key and placeholder parity, the version pair |
| `tests/toolchain.test.ts` | the `vite` override |

A change to what the card does comes with a test that fails without it.

### Coverage

There is no coverage gate, and the provider is not a dependency. To measure it once:

```bash
V=$(npx vp toolchain vitest | grep -oE 'vitest@[0-9.]+' | head -1 | cut -d@ -f2)
npm i --no-save @vitest/coverage-v8@"$V"
npx vp test run --coverage --coverage.provider=v8 --coverage.reporter=text \
  '--coverage.include=src/**/*.ts' '--coverage.exclude=src/**/*.test.ts'
```

`--no-save` leaves `package.json` and the lockfile alone; the next `npm ci` removes the provider. Use `--coverage.reporter=json` to write `coverage/coverage-final.json` (gitignored) for tools that read it.

## Version sync

`package.json` `version` and `CARD_VERSION` in `src/const.ts` must match; `tests/i18n.test.ts` checks it and the release workflow refuses a tag that disagrees with `package.json`. A bump edits both, rebuilds the bundle and commits all three together. Neither carries a `-beta` suffix: a pre-release has the final release's number and GitHub's pre-release flag.

## Dependencies

| Package | Pin | Why |
|---|---|---|
| `vite-plus` | exact, `package.json` | it decides what the committed bundle looks like; the `vite` override names the same version |
| `happy-dom` | exact | it decides what the DOM suites see; the sibling cards keep one version |
| `@napi-rs/canvas` | exact | a native prebuilt that draws the preview PNGs and the README images; a bump can change those pixels |
| `lit` | caret | maintained, keeps semver |

- **Dependabot's blind spot.** It bumps `vite-plus` and leaves the override alone. The toolchain test catches that.
- **Runtime vs dev.** What the build inlines into the bundle is a `dependency`; a build-time tool is a `devDependency` even though the build needs it. CI's `npm audit --omit=dev` only means something because of that split.
- **Adding a dependency.** The bundle loads on every dashboard, so a new runtime dependency is discussed in an issue first; today the card has `lit`. Its licence must be compatible with MIT and its notice must survive the build (`comments: { legal: true }` keeps the `@license` comments). Prefer vendoring a few constants with a provenance comment over depending on a package that exports thousands.

## Translations

1. Copy `src/localize/languages/en.json` to `<code>.json` and translate every value. Keep the `{placeholders}`.
2. Import it in `src/localize/localize.ts` as a default import (`import sv from "./languages/sv.json"`) and add it to `LANGUAGE_REGISTRY`, which drives both the lookup and the editor's dropdown.
3. Run `npm test`. `tests/i18n.test.ts` checks that every language has the same keys and placeholders as English.

Missing keys fall back to English, so a partial translation is still a useful PR. German uses du, never Sie. Numbers come from the browser's `Intl`, so they don't need translating.

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

A layer is one entry in `src/layers/registry.ts`: its id, an icon, the chunks it needs at a scale, the scale from which it draws, and a `draw` function. Add the id to `LAYER_IDS` in `src/types.ts` and a name under `layers` in both language files. The loader, the layer list on the map and the editor read the registry, so there is nothing else to wire.

### Adding a fact about a place

Population is one column of a table. Another fact (area, altitude) is another column: add it to the table in `scripts/build-data.mjs` with a `key`, a `label` translation key and its `source`, add the label under `facts` in both language files, and rebuild the data. The info panel shows whatever columns a table carries. River and road sets carry facts the same way, one value per river name or route (their length). A value prints as a plain number (`integer`), in metres (`metres`), or in kilometres from tenths of a kilometre (`kilometres`).

### Changing the chunk format

Bump `DATA_FORMAT` in `src/data/format.ts` whenever a chunk's shape or packing changes. A browser can hold a new card and an old chunk at once; the loader refuses a chunk in another format and asks for a reload instead of drawing it.

## Two builds, thirteen files

`dist/` holds everything a user installs, and it is committed:

| File | Written by | From |
| --- | --- | --- |
| `austria-map-card.js` | `npm run build` (Vite+) | `src/` |
| `austria-map-data-*.js` (twelve) | `npm run build:data` | `scripts/data/*.gz` |

The card's file holds code only. A dashboard resource loads on every dashboard, so the geometry lives in the twelve chunks and the card imports each one the first time a layer or zoom level needs it:

| Chunk | Holds | Loaded |
| --- | --- | --- |
| `base` | Country and province borders, terrain overview, larger rivers | With the first map |
| `places` | Towns and villages | Towns layer on |
| `borders` | Fine borders down to districts, names and population of all districts and municipalities | Zoomed in, or districts or municipalities on |
| `gemeinden` | Municipality borders | Municipalities on and zoomed in |
| `terrain-detail` | Terrain in 11 bands | Terrain on and zoomed in |
| `rivers-detail` | Rivers and streams down to stream order 3 | Rivers on and zoomed in |
| `peaks` | Summits | Peaks layer on |
| `motorways` | Motorway and expressway routes | Motorways layer on |
| `main-roads` | Main road routes | Main roads layer on |
| `lakes` | Lakes and their names | Lakes layer on |
| `glaciers` | Glaciers and their names | Glaciers layer on |
| `relief` | Ground height for the 3D view | The first time the map tilts |

Change `src/` and you rebuild the card. Change the data script, the projection, the chunk format or an input, and you rebuild the data. CI checks both against a fresh build.

## Looking at the map without a browser

`npm run preview` draws real frames with the card's own renderer through `@napi-rs/canvas`: the whole country, a province, a municipal zoom, light and dark. Look at them before you commit a change to drawing code or data. The PNGs land in `.cache/preview/`, which git ignores. Add a scene to the list in `scripts/preview.mjs` when you need another view.

`npm run preview -- --readme` also rewrites the README images: `screenshots/preview.webp` and its dark-theme twin `screenshots/preview-dark.webp`, both transparent outside the border.

## Refreshing the data

The build reads only `scripts/data/*.gz`, so it needs no network. To move to a newer release of a source, change its URL and date at the top of `scripts/build-data.mjs`, then:

```bash
node scripts/build-data.mjs --refresh-borders      # BEV, 3 MB
node scripts/build-data.mjs --refresh-terrain      # BEV, 1.5 MB
node scripts/build-data.mjs --refresh-rivers       # BMLUK, 59 MB
node scripts/build-data.mjs --refresh-places       # BEV, 58 MB
node scripts/build-data.mjs --refresh-peaks        # BEV, the same 58 MB file as the places
node scripts/build-data.mjs --refresh-motorways    # BEV, 1.3 GB
node scripts/build-data.mjs --refresh-main-roads   # BEV, the same 1.3 GB file as the motorways
node scripts/build-data.mjs --refresh-population   # Statistik Austria, 18 MB
node scripts/build-data.mjs --refresh-lakes        # BEV, 77 MB
node scripts/build-data.mjs --refresh-glaciers     # BEV, the same 77 MB file, and the names file
node scripts/build-data.mjs --refresh              # all of them
```

Downloads are kept in `.cache/` (ignored by git); add `--download` to fetch one again. Rivers and places are cut against the borders, so refresh those after the borders. The build fails if the borders and the population table do not list the same municipalities.

`node scripts/build-data.mjs --measure` prints the chunk sizes for a range of tolerances. The tables in the script's comments come from it; update them when you change a setting.

## Style

- TypeScript strict; the `tsconfig.json` flags are not negotiable, and `vp check` reports no warnings (`denyWarnings`).
- Comments say why, not what; identifiers carry the what.
- The browser floor is ES2022: `sorted()` from `src/sorted.ts` instead of `toSorted()`; the Node-only scripts may use it.
- Imports carry their `.ts` extension. The build scripts load the same files through Node, which needs it. For the same reason, files under `src/data/`, `src/layers/` and `src/map/` use no enums, no parameter properties and no decorators.
- Runtime dependencies are `lit`; adding one goes through *Dependencies*.
- German copy uses du.

## Reporting issues

Open an issue with:

- your Home Assistant version and the card version (the console banner, or the `?v=` on the resource)
- your browser
- the card's YAML and a screenshot

A security problem goes through **Report a vulnerability** under the repository's **Security** tab, not a public issue.
