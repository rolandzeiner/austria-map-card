# Austria Map Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![Version](https://img.shields.io/github/v/release/rolandzeiner/austria-map-card?include_prereleases&label=version&color=blue)](https://github.com/rolandzeiner/austria-map-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![vibe-coded](https://img.shields.io/badge/vibe-coded-ff69b4?logo=musicbrainz&logoColor=white)](https://en.wikipedia.org/wiki/Vibe_coding)

A map of Austria for your Home Assistant dashboard. Switch layers on and off, zoom from the whole country down to a single municipality, and select a place to see what it is. Drawn from official Austrian open data. No integration, no account, and no request ever leaves your Home Assistant.

<img src="https://raw.githubusercontent.com/rolandzeiner/austria-map-card/main/screenshots/preview.webp" alt="Map of Austria with terrain, rivers, province borders and the largest towns" />

## Features

- **Six layers** *(0.1.0)*: terrain, rivers, provinces (Bundesländer), districts (Bezirke), municipalities (Gemeinden), and towns. Switch them from the layer button on the map.
- **Free zoom, 1× to 40×** *(0.1.0)*: drag, pinch, double-tap, the `+` and `−` buttons, or Ctrl/⌘ + scroll. Plain scrolling moves the dashboard, not the map.
- **More detail as you zoom in** *(0.1.0)*: finer borders and terrain, smaller streams, and more names appear when there is room for them.
- **Names on the map** *(0.1.0)*: provinces, districts, municipalities, towns ranked by population, and rivers lettered along their course.
- **Select a place** *(0.1.0)*: a town, a river, or an area. The panel under the map shows its name, what it is, the district and province it belongs to, and its population.
- **Loads only what you look at** *(0.1.0)*: the card itself is small. Map data arrives in six separate files, each fetched the first time a layer or zoom level needs it.
- **Follows your theme** *(0.1.0)*: light and dark, with its own terrain shading for each.
- **Open one province** *(0.1.0)*: start on all of Austria or on a single province.
- **Keyboard and screen reader support** *(0.1.0)*: every gesture has a button and a key.
- **English and German** *(0.1.0)*.

## Installation

### HACS (recommended)

[![Add to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=rolandzeiner&repository=austria-map-card&category=plugin)

1. In HACS, open ⋯ → **Custom repositories**.
2. Add `https://github.com/rolandzeiner/austria-map-card` with the type **Dashboard** (**Lovelace** in older HACS versions).
3. Install **Austria Map Card**.
4. Reload your browser (⌘⇧R or Ctrl⇧R).

HACS downloads seven files: the card and six data files. Keep them together.

### Manual

1. Download **all seven** `.js` files from the [latest release](https://github.com/rolandzeiner/austria-map-card/releases).
2. Copy them to `<config>/www/community/austria-map-card/`.
3. Add a dashboard resource: `/local/community/austria-map-card/austria-map-card.js`, type **JavaScript module**.

The card finds its data files next to its own file. If one is missing, that layer does not load and the card says so.

## Quick start

```yaml
type: custom:austria-map-card
```

That shows all of Austria with terrain, rivers, province borders and towns.

## Configuration

Every option is optional. Use the visual editor or YAML.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string | none | Heading above the map. |
| `view` | `austria`, or `AT-1` to `AT-9` | `austria` | What the card opens on, and what **Reset view** returns to. See [Province codes](#province-codes). |
| `layers` | list | `terrain`, `rivers`, `provinces`, `cities` | The layers that are on when the card opens. See [Layers](#layers). An empty list shows only the country's outline. |
| `show_labels` | boolean | `true` | Names on the map. |
| `show_layer_control` | boolean | `true` | The layer button. Turn it off to lock the layers, for example on a wall display. |

Layers you switch on the map stay that way until the page reloads. To change what the card opens with, edit `layers`.

### Layers

| Layer | Shows | Good to know |
| --- | --- | --- |
| `terrain` | Ground height, in bands from 400 m to 2500 m | 8 bands on the whole country, 11 once you zoom in. |
| `rivers` | Rivers and streams | Larger rivers first. Smaller streams appear as you zoom in. |
| `provinces` | The nine province borders | |
| `districts` | The 94 district borders | |
| `municipalities` | The 2,092 municipality borders | Appears once you zoom in. On the whole country they would be a grey smear. |
| `cities` | Towns and villages | The capitals and the six cities over 100,000 always show. Others appear by size as you zoom in. |

### Province codes

| Code | Province | Code | Province | Code | Province |
| --- | --- | --- | --- | --- | --- |
| `AT-1` | Burgenland | `AT-4` | Oberösterreich | `AT-7` | Tirol |
| `AT-2` | Kärnten | `AT-5` | Salzburg | `AT-8` | Vorarlberg |
| `AT-3` | Niederösterreich | `AT-6` | Steiermark | `AT-9` | Wien |

### Examples

A district map of Tyrol:

```yaml
type: custom:austria-map-card
title: Tirol
view: AT-7
layers:
  - terrain
  - rivers
  - provinces
  - districts
```

A fixed map for a wall display:

```yaml
type: custom:austria-map-card
show_layer_control: false
layers:
  - terrain
  - provinces
  - cities
```

## Controls

| To | Mouse or touch | Keyboard (map focused) |
| --- | --- | --- |
| Move the map | Drag | Arrow keys |
| Zoom | Pinch, double-tap, `+` / `−` buttons, Ctrl or ⌘ + scroll | `+` / `−` |
| Return to the opening view | **Reset view** button | `0` |
| See what is at a spot | Tap or click it | `Enter` reads out what is under the crosshair |

On the whole-country view there is nothing to drag, so a vertical swipe scrolls your dashboard. Once you zoom in, the map takes the swipe.

## How the map loads

A dashboard resource loads on every dashboard, whether it shows a map or not. So the card's own file holds only code, and the map data sits in six files beside it:

| File | Holds | Loaded | Size (compressed) |
| --- | --- | --- | --- |
| `austria-map-card.js` | The card | Always | 82 KB (28 KB) |
| `austria-map-data-base.js` | Country and province borders, terrain overview, larger rivers | With the first map | 62 KB (42 KB) |
| `austria-map-data-places.js` | 2,029 towns and villages | Towns layer on | 61 KB (29 KB) |
| `austria-map-data-borders.js` | Fine borders down to districts, names and population of all districts and municipalities | Zoomed in, or districts or municipalities on | 142 KB (81 KB) |
| `austria-map-data-gemeinden.js` | Municipality borders | Municipalities on and zoomed in | 189 KB (126 KB) |
| `austria-map-data-terrain-detail.js` | Terrain in 11 bands | Terrain on and zoomed in | 116 KB (75 KB) |
| `austria-map-data-rivers-detail.js` | Rivers and streams down to stream order 3 | Rivers on and zoomed in | 220 KB (140 KB) |

Each file loads once per page. Everything comes from your own Home Assistant: the card makes no request to any other server.

## Data sources

All map data is official Austrian open data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The card credits the sources below the map.

| Data | Source | As of |
| --- | --- | --- |
| Borders | BEV, [Verwaltungsgrenzen (VGD) 1:250 000](https://www.data.gv.at/datasets/d960f393-0a19-43f7-b2f1-2a79d9fc6fdd) | 01.04.2026 |
| Terrain | BEV, [Digitales Geländehöhenmodell, Höhenraster 500 m](https://www.data.gv.at/datasets/e629ae18-8f69-40ab-838a-1c0c60ebe727) | 15.04.2021 |
| Rivers | BMLUK, [Flussordnungszahlen NGP 2021 (Gesamtgewässernetz)](https://www.data.gv.at/datasets/e73a9425-a833-4579-9e6e-3ca76a1ea943) | 2021 |
| Towns | BEV, [Digitales Landschaftsmodell, Namen](https://data.bev.gv.at/download/DLM/DLM_20260323/) | 23.03.2026 |
| Population | Statistik Austria, [Bevölkerung zu Jahresbeginn 2026](https://data.statistik.gv.at/web/meta.jsp?dataset=OGD_bevstandjbab2002_BevStand_2026) | 01.01.2026 |

The data was changed for this card: borders, terrain and rivers are simplified, municipalities are merged from cadastral units, and towns are a selection of the BEV's 58,000 place names.

## Theming

The map takes its colours from your theme. One variable is the card's own:

| Variable | Sets | Default |
| --- | --- | --- |
| `--austria-map-accent-color` | The selection and the focus ring | Your theme's primary colour |

## Accessibility

- Every drag and pinch has a button and a key.
- The map takes keyboard focus. A crosshair marks the centre, and `Enter` reads out what is under it.
- The panel under the map announces a new selection to screen readers.
- Controls are at least 40 px, with a visible focus ring.
- The card has no animation beyond the layer switch, and honours reduced motion.

## Known limitations

- **The map is not for navigation.** Borders come from a 1:250 000 dataset and are simplified further. Positions are on Austria's MGI datum, about 100 m off GPS coordinates.
- **No lakes yet.** Rivers are lines; Lake Constance and Lake Neusiedl are not drawn.
- **No Home Assistant entities yet.** This version shows geography and population only.
- **Names are the official ones.** Towns carry the BEV's spelling, municipalities the register's, so "St. Pölten" and "Sankt Johann" both occur.
- **A town shows its municipality's population**, and only where the two share a name.
- **Pinch to zoom from the whole-country view** depends on the browser. If it does not respond, zoom in once with the `+` button or a double-tap.

## Build from source

Needs Node 24 or newer.

```bash
npm install
npm run build        # the card:      dist/austria-map-card.js
npm run build:data   # the map data:  dist/austria-map-data-*.js
npm test
npm run preview      # draws the map to PNG files in .cache/preview/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, including how to refresh the data from its sources.

## License

The code is [MIT](LICENSE). The map data in `dist/austria-map-data-*.js` and `scripts/data/` is © BEV, BMLUK and Statistik Austria, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
