#!/usr/bin/env node
// Draws the map to image files with the card's own renderer.
//
//   node scripts/preview.mjs            every scene below, as PNG, into .cache/preview/
//   node scripts/preview.mjs --readme   also writes screenshots/preview.webp for the README
//
// There is no browser in this: the renderer only needs a 2D context and a
// Path2D, and @napi-rs/canvas (a dev dependency) has both. So the look of a
// change to the drawing code or to the data can be checked from the command
// line, in the light and the dark theme, before it goes anywhere near Home
// Assistant. The colours are Home Assistant's default themes run through
// the card's own palette; a custom theme will differ.
//
// Needs Node 24 or newer (it imports the card's TypeScript directly) and the
// data chunks in dist/ (`npm run build:data`).

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Path2D, createCanvas } from "@napi-rs/canvas";

import { CHUNK_IDS, chunkFile } from "../src/data/format.ts";
import { MapStore } from "../src/layers/store.ts";
import { clampCamera, fitBox, fitScale, homeCamera } from "../src/map/camera.ts";
import { DARK_THEME, LIGHT_THEME, derivePalette } from "../src/map/palette.ts";
import { MapRenderer } from "../src/map/renderer.ts";

const root = new URL("../", import.meta.url);
const OUT = new URL(".cache/preview/", root);
const README_IMAGE = new URL("screenshots/preview.webp", root);

const store = new MapStore();
for (const id of CHUNK_IDS) {
  const module = await import(new URL(`dist/${chunkFile(id)}`, root).href);
  store.add(module.default);
}

const everything = ["terrain", "rivers", "municipalities", "districts", "provinces", "cities"];
const standard = ["terrain", "rivers", "provinces", "cities"];

/** The row of a municipality or a province by its official code. */
const municipality = (code) => store.detail.municipalities.ids.indexOf(code);
const province = (code) => store.overview.provinces.ids.indexOf(code);

/**
 * Each scene: canvas size in CSS pixels, theme, layers, and a camera given
 * either as a province to fit or as a centre (a municipality's label point)
 * with a zoom factor.
 */
const scenes = [
  { name: "overview-phone", width: 400, height: 212, theme: LIGHT_THEME, layers: standard },
  { name: "overview", width: 760, height: 403, theme: LIGHT_THEME, layers: standard },
  { name: "overview-dark", width: 760, height: 403, theme: DARK_THEME, layers: standard },
  { name: "overview-districts", width: 760, height: 403, theme: LIGHT_THEME, layers: [...standard, "districts"] },
  { name: "province-tirol", width: 760, height: 403, theme: LIGHT_THEME, layers: [...standard, "districts"], fit: "AT-7" },
  { name: "province-wien", width: 760, height: 403, theme: LIGHT_THEME, layers: everything, fit: "AT-9" },
  { name: "municipalities-salzkammergut", width: 760, height: 403, theme: LIGHT_THEME, layers: everything, at: "40709", zoom: 9 },
  { name: "municipalities-dark", width: 760, height: 403, theme: DARK_THEME, layers: everything, at: "40709", zoom: 9 },
  { name: "deep-zoom", width: 760, height: 403, theme: LIGHT_THEME, layers: everything, at: "70101", zoom: 40 },
  { name: "selected", width: 760, height: 403, theme: LIGHT_THEME, layers: [...standard, "districts"], fit: "AT-6", select: "AT-6" },
  { name: "bare", width: 760, height: 403, theme: LIGHT_THEME, layers: [] },
];

function cameraFor(scene, size) {
  if (scene.fit !== undefined) return fitBox(store.overview.index.box(province(scene.fit)), size, 16);
  if (scene.at !== undefined) {
    const row = municipality(scene.at);
    const { at } = store.detail.municipalities;
    return clampCamera({ x: at[row * 2], y: at[row * 2 + 1], k: fitScale(size) * scene.zoom }, size);
  }
  return homeCamera(size);
}

function render(scene, pixelRatio) {
  const canvas = createCanvas(1, 1);
  const renderer = new MapRenderer(canvas, store, () => new Path2D());
  renderer.resize(scene.width, scene.height, pixelRatio);
  const palette = derivePalette(scene.theme);
  renderer.setPalette(palette);
  // The card's own background, which the canvas in the card lets show through.
  const ctx = canvas.getContext("2d");
  renderer.draw({
    camera: cameraFor(scene, renderer.size),
    layers: new Set(scene.layers),
    showLabels: scene.labels ?? true,
    selection: scene.select === undefined ? null : { kind: "province", row: province(scene.select) },
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = `rgb(${scene.theme.background.join(",")})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

const only = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
mkdirSync(OUT, { recursive: true });
for (const scene of scenes) {
  if (only.length > 0 && !only.includes(scene.name)) continue;
  const started = performance.now();
  const canvas = render(scene, 2);
  const file = new URL(`${scene.name}.png`, OUT);
  writeFileSync(file, canvas.toBuffer("image/png"));
  console.log(`${fileURLToPath(file).replace(fileURLToPath(root), "")}  ${Math.round(performance.now() - started)} ms`);
}

if (process.argv.includes("--readme")) {
  const canvas = render({ ...scenes.find((scene) => scene.name === "overview"), width: 900, height: 477 }, 2);
  mkdirSync(new URL("./", README_IMAGE), { recursive: true });
  writeFileSync(README_IMAGE, canvas.toBuffer("image/webp", 88));
  console.log(fileURLToPath(README_IMAGE).replace(fileURLToPath(root), ""));
}
