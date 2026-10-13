import { css } from "lit";

// Card styles, isolated in the card's shadow root. Theme variables pierce
// the boundary, so var(--primary-text-color) etc. follow the HA theme.
//
// The --amc-* tokens are what the canvas is painted from: the card reads
// their computed values through a probe element and mixes the map's colours
// out of them (src/map/palette.ts). One override is read from a theme or
// card-mod:
//   --austria-map-accent-color   the selection and the focus ring
//                                (default: the theme's primary colour)
export const cardStyles = css`
  :host {
    /* No color-scheme here: Home Assistant sets it on the document from the
       active theme and the card inherits it. */
    display: block;

    /* Fill the grid cell the dashboard hands us. A sections view gives the
       cell WRAPPER a fixed pixel height whenever rows is numeric -- which a
       user causes just by dragging the row handle -- and styles nothing
       inside it. With display: block above, this element is ha-card's
       containing block, so ha-card's block-size: 100% resolves against this
       line; without it that percentage computes to auto and the card paints
       over the card below. The pair is guarded by tests/grid-cell.test.ts. */
    block-size: 100%;

    container-type: inline-size;
    container-name: austria-map-card;

    --amc-background: var(--ha-card-background, var(--card-background-color, #fff));
    --amc-text: var(--primary-text-color, #212121);
    --amc-muted: var(--secondary-text-color, #727272);
    --amc-accent: var(--austria-map-accent-color, var(--primary-color, #03a9f4));
    --amc-line: var(--divider-color, rgba(0, 0, 0, 0.12));
    --amc-pad-x: var(--ha-space-4, 16px);
    --amc-pad-y: var(--ha-space-3, 12px);
    --amc-control: 40px;
  }

  ha-card {
    /* overflow: hidden keeps a card taller than its cell clipped inside its
       own bounds instead of painting over its neighbour. */
    overflow: hidden;
    block-size: 100%;
    display: flex;
    flex-direction: column;
    color: var(--amc-text);
  }

  /* Resolves the tokens above for the canvas; never seen. */
  .probe {
    position: absolute;
    inline-size: 0;
    block-size: 0;
    overflow: hidden;
    visibility: hidden;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .title {
    margin: 0;
    padding: var(--amc-pad-y) var(--amc-pad-x) 0;
    font-size: var(--ha-font-size-l, 1.143rem);
    font-weight: var(--ha-font-weight-medium, 500);
    line-height: 1.3;
  }

  /* ── The map ─────────────────────────────────────────────────────────
     The stage takes the map's own proportions where the card's height is
     free (a masonry view) and whatever is left where it is fixed (a
     sections cell): flex may stretch or squeeze it, and min-block-size: 0
     lets it go below the height the aspect ratio asks for. */
  .stage {
    position: relative;
    flex: 1 1 auto;
    min-block-size: 0;
    aspect-ratio: 1000 / 530;
    margin: var(--ha-space-2, 8px) var(--ha-space-2, 8px) 0;
  }
  canvas {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    display: block;
    border-radius: var(--ha-border-radius-md, 8px);
    cursor: grab;
    /* On the whole-country view there is nothing to drag, so a vertical
       swipe scrolls the dashboard and the card never traps the page. */
    touch-action: pan-y;
    -webkit-tap-highlight-color: transparent;
  }
  canvas.zoomed {
    touch-action: none;
  }
  canvas.dragging {
    cursor: grabbing;
  }
  canvas:focus-visible {
    outline: 2px solid var(--amc-accent);
    outline-offset: -2px;
  }

  /* Marks the spot that Enter reads out, while the map has keyboard focus. */
  .crosshair {
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    inline-size: 22px;
    block-size: 22px;
    margin: -11px 0 0 -11px;
    pointer-events: none;
    display: none;
    background:
      linear-gradient(var(--amc-accent), var(--amc-accent)) center / 2px 100% no-repeat,
      linear-gradient(var(--amc-accent), var(--amc-accent)) center / 100% 2px no-repeat;
  }
  canvas:focus-visible ~ .crosshair {
    display: block;
  }

  /* ── Controls on the map ─────────────────────────────────────────── */
  .toolbar {
    position: absolute;
    inset-block-start: var(--ha-space-2, 8px);
    inset-inline-end: var(--ha-space-2, 8px);
    display: flex;
    flex-direction: column;
    gap: var(--ha-space-1, 4px);
  }
  .tool,
  .icon {
    inline-size: var(--amc-control);
    block-size: var(--amc-control);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-md, 8px);
    background: var(--amc-background);
    color: var(--amc-text);
    cursor: pointer;
    --mdc-icon-size: 20px;
  }
  .tool:disabled {
    cursor: default;
    color: var(--disabled-text-color, #9e9e9e);
  }
  .tool[aria-expanded="true"] {
    border-color: var(--amc-accent);
    color: var(--amc-accent);
  }
  .tool-gap {
    block-size: var(--ha-space-1, 4px);
  }

  .layers {
    position: absolute;
    inset-block-start: var(--ha-space-2, 8px);
    inset-inline-end: calc(var(--amc-control) + var(--ha-space-4, 16px));
    inline-size: min(260px, calc(100% - var(--amc-control) - var(--ha-space-6, 24px)));
    max-block-size: calc(100% - var(--ha-space-4, 16px));
    overflow-y: auto;
    padding: var(--ha-space-1, 4px);
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-lg, 12px);
    background: var(--amc-background);
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.2));
  }
  .layers h3 {
    margin: 0;
    padding: var(--ha-space-2, 8px) var(--ha-space-2, 8px) var(--ha-space-1, 4px);
    font-size: var(--ha-font-size-s, 0.857rem);
    font-weight: var(--ha-font-weight-medium, 500);
    color: var(--amc-muted);
  }
  .layer {
    inline-size: 100%;
    min-block-size: var(--amc-control);
    display: flex;
    align-items: center;
    gap: var(--ha-space-2, 8px);
    padding: var(--ha-space-1, 4px) var(--ha-space-2, 8px);
    border: 0;
    border-radius: var(--ha-border-radius-md, 8px);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
    --mdc-icon-size: 20px;
  }
  .layer:hover {
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
  }
  .layer-text {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .layer-note {
    font-size: var(--ha-font-size-s, 0.857rem);
    color: var(--amc-muted);
  }
  /* A switch drawn in CSS: on is told by position and by fill, not by
     colour alone (WCAG 1.4.1). */
  .switch {
    flex: none;
    inline-size: 34px;
    block-size: 20px;
    border-radius: 10px;
    border: 2px solid var(--amc-muted);
    box-sizing: border-box;
    position: relative;
    transition: background-color 120ms ease, border-color 120ms ease;
  }
  .switch::after {
    content: "";
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    inline-size: 12px;
    block-size: 12px;
    border-radius: 50%;
    background: var(--amc-muted);
    transition: transform 120ms ease, background-color 120ms ease;
  }
  .layer[aria-checked="true"] .switch {
    background: var(--amc-accent);
    border-color: var(--amc-accent);
  }
  .layer[aria-checked="true"] .switch::after {
    transform: translateX(14px);
    background: var(--amc-background);
  }
  :host(:dir(rtl)) .layer[aria-checked="true"] .switch::after {
    transform: translateX(-14px);
  }

  /* ── Messages on the map ─────────────────────────────────────────── */
  .toast,
  .notice {
    position: absolute;
    inset-inline: var(--ha-space-2, 8px);
    inset-block-end: var(--ha-space-2, 8px);
    margin-inline: auto;
    inline-size: fit-content;
    max-inline-size: calc(100% - var(--ha-space-4, 16px));
    padding: var(--ha-space-2, 8px) var(--ha-space-3, 12px);
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-md, 8px);
    background: var(--amc-background);
    font-size: var(--ha-font-size-s, 0.857rem);
    line-height: 1.35;
  }
  .toast {
    pointer-events: none;
  }
  .notice {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ha-space-2, 8px);
  }
  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--amc-muted);
    pointer-events: none;
  }

  .text {
    min-block-size: var(--amc-control);
    padding: 0 var(--ha-space-3, 12px);
    border: 1px solid var(--amc-line);
    border-radius: var(--ha-border-radius-md, 8px);
    background: none;
    color: var(--amc-accent);
    font: inherit;
    font-weight: var(--ha-font-weight-medium, 500);
    cursor: pointer;
  }

  /* ── What was tapped ─────────────────────────────────────────────── */
  .info {
    display: flex;
    align-items: flex-start;
    gap: var(--ha-space-2, 8px);
    padding: var(--ha-space-2, 8px) var(--amc-pad-x) 0;
    min-block-size: var(--amc-control);
  }
  .info-text {
    flex: 1;
    min-inline-size: 0;
    line-height: 1.4;
  }
  .info-name {
    margin: 0;
    font-size: var(--ha-font-size-l, 1.143rem);
    font-weight: var(--ha-font-weight-medium, 500);
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .info-kind {
    font-size: var(--ha-font-size-m, 1rem);
    font-weight: var(--ha-font-weight-normal, 400);
    color: var(--amc-muted);
  }
  .info-parents,
  .info-idle {
    margin: 0;
    color: var(--amc-muted);
  }
  .info-idle {
    align-self: center;
  }
  .facts {
    margin: var(--ha-space-1, 4px) 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--ha-space-1, 4px) var(--ha-space-4, 16px);
  }
  .facts div {
    display: flex;
    flex-direction: column;
  }
  .facts dt {
    font-size: var(--ha-font-size-s, 0.857rem);
    color: var(--amc-muted);
  }
  .facts dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .fact-source {
    display: block;
    font-size: var(--ha-font-size-s, 0.857rem);
    color: var(--amc-muted);
  }
  .info-actions {
    flex: none;
    display: flex;
    gap: var(--ha-space-1, 4px);
  }

  .credit {
    margin: 0;
    padding: var(--ha-space-2, 8px) var(--amc-pad-x) var(--amc-pad-y);
    font-size: var(--ha-font-size-s, 0.857rem);
    line-height: 1.4;
    color: var(--amc-muted);
  }
  .credit a {
    color: inherit;
  }

  @container austria-map-card (inline-size < 360px) {
    .info {
      flex-direction: column;
    }
    .info-actions {
      align-self: flex-end;
    }
  }

  /* ── Accessibility primitives ───────────────────────────────────── */
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--amc-accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  @media (forced-colors: active) {
    a:focus-visible,
    button:focus-visible,
    canvas:focus-visible {
      outline-color: CanvasText;
    }
    .layer[aria-checked="true"] .switch {
      background: Highlight;
      border-color: Highlight;
    }
    .crosshair {
      forced-color-adjust: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
