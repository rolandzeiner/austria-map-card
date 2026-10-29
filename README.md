# <sub><sub><img src="https://raw.githubusercontent.com/rolandzeiner/austria-map-card/main/brand/icon.png" width="40" height="40" alt=""></sub></sub> Austria Map Card

[![Marketplace](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://www.home-assistant.io/integrations/marketplace/)
[![Version](https://img.shields.io/github/v/release/rolandzeiner/austria-map-card?include_prereleases&label=version&color=blue)](https://github.com/rolandzeiner/austria-map-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![vibe-coded](https://img.shields.io/badge/vibe-coded-ff69b4?logo=musicbrainz&logoColor=white)](https://en.wikipedia.org/wiki/Vibe_coding)

A map of Austria for your Home Assistant dashboard, drawn from official Austrian open data. Switch layers on and off, zoom from the whole country down to a single municipality, and select a place to see what it is. No integration, no account, and no request ever leaves your Home Assistant.

## Screenshots

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/rolandzeiner/austria-map-card/main/screenshots/preview-dark.webp" />
  <img src="https://raw.githubusercontent.com/rolandzeiner/austria-map-card/main/screenshots/preview.webp" alt="Map of Austria with terrain, glaciers, lakes, rivers, province borders, motorways with route shields, named peaks and the largest towns" />
</picture>

## Features

- **Eleven layers**: terrain, glaciers, lakes, rivers, provinces, districts, municipalities, towns, peaks, motorways and main roads, switched from a button on the map.
- **Zoom from 1× to 40×**: finer borders, smaller streams and more names appear as you zoom in.
- **Select a place**: a town, river, road, peak or area, and the panel under the map says what it is and where it lies.
- **3D view, experimental**: tilt and turn the map to see the mountains in relief. A compass turns you back to north.
- **Mark where you are**: a pin for your home, the device you're on, or a person or tracker as they move.
- **Open on one province**: start on all of Austria or on a single province.
- **Loads only what you look at**: the card is small, and each layer's data arrives the first time you need it.
- **Theme, keyboard and language**: follows your light or dark theme, every gesture has a button and a key, in English and German.

## Requirements

- A browser with WebGL 2 for the 3D view. Without it, the 3D button and the compass don't show, and the map stays flat.

## Installation

### Marketplace (recommended)

The Marketplace is HACS, built into Home Assistant since 2026.11.

[![Open this repository in the Marketplace of your Home Assistant.](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=rolandzeiner&repository=austria-map-card&category=plugin)

1. In **Settings → Marketplace**, select **Add from link**.
2. Enter `rolandzeiner/austria-map-card` and select **Add**. The first time, the Marketplace asks you to connect GitHub.
3. Open **Austria Map Card** and select **Install**. Then reload your browser.

On Home Assistant older than 2026.11, add the repository in HACS under ⋮ → **Custom repositories** with type **Dashboard**, then download it and reload the browser.

The download is thirteen files: the card and twelve data files. Keep them together.

### Manual

1. Download **all thirteen** `.js` files from the [latest release](https://github.com/rolandzeiner/austria-map-card/releases).
2. Copy them to `<config>/www/community/austria-map-card/`.
3. Add a dashboard resource: `/local/community/austria-map-card/austria-map-card.js`, type **JavaScript module**.

The card finds its data files next to its own file. If one is missing, that layer does not load and the card says so.

## Configuration

Every option is optional. Use the visual editor or YAML.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string | none | Heading above the map. |
| `view` | `austria`, or `AT-1` to `AT-9` | `austria` | What the card opens on, and what **Reset view** returns to. See *Province codes*. |
| `layers` | list | `terrain`, `lakes`, `rivers`, `provinces`, `cities` | The layers that are on when the card opens. See *Layers*. An empty list shows only the country's outline. |
| `show_labels` | boolean | `true` | Names on the map. |
| `show_layer_control` | boolean | `true` | The layer button. Turn it off to lock the layers, for example on a wall display. |
| `show_location` | boolean | `false` | A pin that marks where you are, and a button that goes to it. |
| `location` | `home`, `device`, or an entity id | `home` | Where the pin goes. See *Your location*. |

The smallest configuration shows all of Austria with terrain, lakes, rivers, province borders and towns:

```yaml
type: custom:austria-map-card
```

Layers you switch on the map stay that way until the page reloads. To change what the card opens with, edit `layers`.

### Layers

| Layer | Shows | Good to know |
| --- | --- | --- |
| `terrain` | Ground height, in bands from 400 m to 2500 m | 8 bands on the whole country, 11 once you zoom in. |
| `glaciers` | 590 glaciers, 369 of them named | Off by default. Glaciers on the border show only their Austrian part. The longest are named first. |
| `lakes` | 1,223 lakes, reservoirs and ponds, 543 of them named | Down to 0.03 km². The Neusiedler See and the Bodensee show only their Austrian part. |
| `rivers` | Rivers and streams | Larger rivers first. Smaller streams appear as you zoom in. Rivers are named along their course. |
| `provinces` | The nine province borders | |
| `districts` | The 94 district borders | |
| `municipalities` | The 2,092 municipality borders | Appears once you zoom in. On the whole country they would be a grey smear. |
| `cities` | 2,029 towns and villages | The capitals and the six cities over 100,000 always show. Others appear by size as you zoom in. |
| `peaks` | 8,014 summits, with name and height | The highest of each range on the whole country. More appear as you zoom in. |
| `motorways` | Motorways (A) and expressways (S) | Route shields such as A1 and S6 along each route. |
| `main_roads` | Main roads (B) | A thin line on the whole country. Route numbers appear once you zoom in. |

### Your location

| `location` | Pin marks | Good to know |
| --- | --- | --- |
| `home` | Your home | The position set in **Settings → System → General**. |
| `device` | The phone, tablet or computer showing the dashboard | Needs HTTPS. The browser asks once for permission. Until it answers, or if you say no, the pin marks your home. |
| `person.anna`, `device_tracker.phone` | That person or tracker | Moves when they do. Works with any entity that has `latitude` and `longitude`, such as a Companion app tracker. Without GPS, an entity that reports `home` shows at your home. |

The position stays in your browser. The card draws it and sends it nowhere.

### Province codes

| Code | Province | Code | Province | Code | Province |
| --- | --- | --- | --- | --- | --- |
| `AT-1` | Burgenland | `AT-4` | Oberösterreich | `AT-7` | Tirol |
| `AT-2` | Kärnten | `AT-5` | Salzburg | `AT-8` | Vorarlberg |
| `AT-3` | Niederösterreich | `AT-6` | Steiermark | `AT-9` | Wien |

### Controls

| To | Mouse or touch | Keyboard (map focused) |
| --- | --- | --- |
| Move the map | Drag | Arrow keys |
| Zoom | Pinch, double-tap, `+` / `−` buttons, Ctrl or ⌘ + scroll | `+` / `−` |
| Return to the opening view, flat | **Reset view** button | `0` |
| See what is at a spot | Tap or click it | `Enter` reads out what is under the crosshair |
| Go to your location | **Show your location** button | Tab to the button, then `Enter` |
| Tilt and turn (3D view) | **3D view** button. Shift + drag, or drag with the right mouse button. Two fingers sliding up or down tilt; a twist turns | Shift + arrow keys |
| Face north | Tap the compass | Tab to the compass, then `Enter` |

Plain scrolling moves the dashboard, not the map. On the whole-country view there is nothing to drag, so a vertical swipe scrolls your dashboard too. Once you zoom in, the map takes the swipe.

The panel under the map announces a new selection to screen readers. Controls are at least 40 px with a visible focus ring, and the card honours reduced motion.

### Theming

The map takes its colours from your theme, with its own terrain shading for light and dark. One variable is the card's own:

| Variable | Sets | Default |
| --- | --- | --- |
| `--austria-map-accent-color` | The selection, the location pin and the focus ring | Your theme's primary colour |

## Examples

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

Follow a person on their phone:

```yaml
type: custom:austria-map-card
show_location: true
location: person.anna
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

## Known limitations

- **The map is not for navigation.** Borders come from a 1:250 000 dataset and are simplified further. Positions are on Austria's MGI datum, about 100 m off GPS coordinates.
- **Entities only place the pin.** Apart from your location, the card shows geography and population.
- **The pin shows only inside the map.** A position outside Austria and its border margin falls off the map's edge.
- **Names are the official ones.** Towns carry the BEV's spelling, municipalities the register's, so "St. Pölten" and "Sankt Johann" both occur.
- **A town shows its municipality's population**, and only where the two share a name.
- **Pinch to zoom from the whole-country view** depends on the browser. If it does not respond, zoom in once with the `+` button or a double-tap.

## Removal

1. Remove the card from your dashboards.
2. In **Settings → Marketplace**, open **Austria Map Card**, then ⋮ → **Uninstall**. Reload your browser.

After a manual install, delete `<config>/www/community/austria-map-card/` and its dashboard resource instead.

## Attribution

The card credits its sources below the map, for example `Data: BEV, BMLUK, Statistik Austria · CC BY 4.0`. It names the sources whose data is loaded at the moment.

All map data is official Austrian open data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):

| Data | Source | As of |
| --- | --- | --- |
| Borders | Bundesamt für Eich- und Vermessungswesen (BEV), [Verwaltungsgrenzen (VGD) 1:250 000](https://www.data.gv.at/datasets/d960f393-0a19-43f7-b2f1-2a79d9fc6fdd) | 01.04.2026 |
| Terrain | BEV, [Digitales Geländehöhenmodell, Höhenraster 500 m](https://www.data.gv.at/datasets/e629ae18-8f69-40ab-838a-1c0c60ebe727) | 15.04.2021 |
| Rivers | Bundesministerium für Land- und Forstwirtschaft, Klima- und Umweltschutz, Regionen und Wasserwirtschaft (BMLUK), [Flussordnungszahlen NGP 2021 (Gesamtgewässernetz)](https://www.data.gv.at/datasets/e73a9425-a833-4579-9e6e-3ca76a1ea943) | 2021 |
| Towns, peaks and glacier names | BEV, [Digitales Landschaftsmodell, Namen](https://data.bev.gv.at/download/DLM/DLM_20260323/) | 23.03.2026 |
| Roads | BEV, [Digitales Landschaftsmodell, Verkehr](https://data.bev.gv.at/download/DLM/DLM_20260323/) | 23.03.2026 |
| Lakes and glaciers | BEV, [Digitales Landschaftsmodell, Bodenbedeckung](https://data.bev.gv.at/download/DLM/DLM_20260323/) | 23.03.2026 |
| Population | Statistik Austria, [Bevölkerung zu Jahresbeginn 2026](https://data.statistik.gv.at/web/meta.jsp?dataset=OGD_bevstandjbab2002_BevStand_2026) | 01.01.2026 |

The data was changed for this card: borders, terrain and rivers are simplified, municipalities are merged from cadastral units, towns and peaks are a selection of the BEV's place names, roads are joined into routes and simplified, and lakes and glaciers are a selection of the BEV's land cover, simplified.

## License

The code is [MIT](https://github.com/rolandzeiner/austria-map-card/blob/main/LICENSE). The map data in `dist/austria-map-data-*.js` and `scripts/data/` is © BEV, BMLUK and Statistik Austria, under CC BY 4.0 (see *Attribution*).

To build from source or contribute, see [CONTRIBUTING.md](https://github.com/rolandzeiner/austria-map-card/blob/main/CONTRIBUTING.md).

## Disclaimer

This card is not affiliated with or endorsed by the BEV, the BMLUK or Statistik Austria. Map data comes from their [open data](https://www.data.gv.at/) under CC BY 4.0. The developer assumes no liability for the accuracy, completeness or timeliness of the displayed data. Use at your own risk.

---

Diese Karte steht in keiner Verbindung zum BEV, zum BMLUK oder zu Statistik Austria und wird von ihnen nicht unterstützt. Die Kartendaten stammen aus ihren [offenen Daten](https://www.data.gv.at/) und stehen unter CC BY 4.0. Für die Richtigkeit, Vollständigkeit und Aktualität der angezeigten Daten wird keine Haftung übernommen. Nutzung auf eigene Verantwortung.
