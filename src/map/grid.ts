/**
 * The reference grid of a theme that has one: square cells over the map,
 * numbered from west to east and lettered from north to south, as on a
 * folded road map. "C4" is a cell.
 *
 * The cells are fixed to the ground, so they move and grow with the map.
 * Ten columns by five rows hold the whole country: a cell is 106 map units,
 * about 62 km, across. The lines run on past them over the open sea; only
 * the cells that hold a piece of Austria have a name.
 */
import type { Lines } from "../data/format.ts";
import { toScreen, type Box, type Camera, type Size } from "./camera.ts";
import type { Rect } from "./label-placer.ts";
import type { GridStyle } from "./palette.ts";
import { MAP_HEIGHT, MAP_WIDTH } from "./projection.ts";

export const GRID_ROWS = 5;
export const GRID_COLUMNS = 10;
/** A cell's side in map units: five rows fill the map's height exactly. */
export const GRID_CELL = MAP_HEIGHT / GRID_ROWS;
/** The west edge of column 1: the ten columns are centred on the map. */
export const GRID_LEFT = (MAP_WIDTH - GRID_COLUMNS * GRID_CELL) / 2;
/** Thickness in pixels of the strips that carry the references. */
export const RULER = 16;

/** The name of a column or a row, or "" outside the named cells. */
export const columnName = (column: number): string =>
  column >= 0 && column < GRID_COLUMNS ? String(column + 1) : "";
export const rowName = (row: number): string =>
  row >= 0 && row < GRID_ROWS ? String.fromCharCode(65 + row) : "";

/** The first and last grid line inside a stretch of an axis, as counts from the origin. */
function span(low: number, high: number, origin: number): [first: number, last: number] {
  return [Math.ceil((low - origin) / GRID_CELL), Math.floor((high - origin) / GRID_CELL)];
}

/**
 * The grid lines across the part of the map in view, a pixel wide, each on
 * a whole device pixel so it stays crisp. Drawn in screen pixels.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  size: Size,
  box: Box,
  style: GridStyle,
): void {
  const crisp = (value: number): number => Math.round(value) + 0.5;
  ctx.save();
  ctx.globalAlpha = style.lineAlpha;
  ctx.strokeStyle = style.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const [west, east] = span(box[0], box[2], GRID_LEFT);
  for (let line = west; line <= east; line += 1) {
    const x = crisp(toScreen(camera, size, GRID_LEFT + line * GRID_CELL, 0)[0]);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.height);
  }
  const [north, south] = span(box[1], box[3], 0);
  for (let line = north; line <= south; line += 1) {
    const y = crisp(toScreen(camera, size, 0, line * GRID_CELL)[1]);
    ctx.moveTo(0, y);
    ctx.lineTo(size.width, y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The strips along the bottom and the right edge, with each cell's number
 * or letter centred on the part of the cell that is in view. Those two
 * edges are the ones the card's buttons never cover. Drawn in screen pixels,
 * over the names: nothing is placed under the strips (see `rulerInset`).
 */
export function drawRuler(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  size: Size,
  box: Box,
  style: GridStyle,
  font: string,
): void {
  const { width, height } = size;
  ctx.save();
  ctx.fillStyle = style.ruler;
  ctx.fillRect(0, height - RULER, width, RULER);
  ctx.fillRect(width - RULER, 0, RULER, height - RULER);

  ctx.font = `600 10px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = style.text;
  ctx.strokeStyle = style.text;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  const along = width - RULER;
  const down = height - RULER;
  ctx.beginPath();
  // A cell wholly or partly in view gets its name where it shows; a sliver
  // too short for a name gets none.
  const [west, east] = span(box[0], box[2], GRID_LEFT);
  for (let column = west - 1; column <= east; column += 1) {
    const from = toScreen(camera, size, GRID_LEFT + column * GRID_CELL, 0)[0];
    const to = from + GRID_CELL * camera.k;
    if (from > 0 && from < along) {
      ctx.moveTo(Math.round(from) + 0.5, down);
      ctx.lineTo(Math.round(from) + 0.5, height);
    }
    const left = Math.max(from, 0);
    const right = Math.min(to, along);
    const name = columnName(column);
    if (name !== "" && right - left >= 14)
      ctx.fillText(name, (left + right) / 2, height - RULER / 2 + 0.5);
  }
  const [north, south] = span(box[1], box[3], 0);
  for (let row = north - 1; row <= south; row += 1) {
    const from = toScreen(camera, size, 0, row * GRID_CELL)[1];
    const to = from + GRID_CELL * camera.k;
    if (from > 0 && from < down) {
      ctx.moveTo(along, Math.round(from) + 0.5);
      ctx.lineTo(width, Math.round(from) + 0.5);
    }
    const top = Math.max(from, 0);
    const bottom = Math.min(to, down);
    const name = rowName(row);
    if (name !== "" && bottom - top >= 12)
      ctx.fillText(name, width - RULER / 2, (top + bottom) / 2 + 0.5);
  }
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.restore();
}

/** The part of the canvas names may use while the ruler is drawn. */
export function rulerInset(size: Size): Rect {
  return { x: 0, y: 0, w: size.width - RULER, h: size.height - RULER };
}

/**
 * The frame of named cells as lines for the tilted map, where the grid lies
 * on the ground: eleven lines down, six across, each one line of two points
 * (relief-lines.ts cuts them to follow the relief).
 */
export function gridLines(): Lines {
  const right = GRID_LEFT + GRID_COLUMNS * GRID_CELL;
  const xy: number[] = [];
  for (let line = 0; line <= GRID_COLUMNS; line += 1) {
    const x = GRID_LEFT + line * GRID_CELL;
    xy.push(x, 0, x, MAP_HEIGHT);
  }
  for (let line = 0; line <= GRID_ROWS; line += 1) {
    xy.push(GRID_LEFT, line * GRID_CELL, right, line * GRID_CELL);
  }
  const count = xy.length / 4;
  return {
    xy: Float32Array.from(xy),
    start: Uint32Array.from({ length: count + 1 }, (_, line) => line * 2),
    count,
    closed: false,
  };
}
