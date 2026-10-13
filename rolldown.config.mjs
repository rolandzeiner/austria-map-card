// Rolldown transpiles, minifies, resolves modules and reads JSON natively, so
// there are no plugins. It does NOT type-check: `tsc --noEmit` is the only
// type-check in the pipeline.
//
// This build writes one file, dist/austria-map-card.js, and that file holds
// code only. The map's geometry lives in dist/austria-map-data-*.js, which
// scripts/build-data.mjs writes and the card imports at run time, one chunk
// at a time, when a layer or a zoom level first needs it. A Lovelace
// resource loads on every dashboard, map or not, which is why several
// hundred kilobytes of borders may not sit in this bundle.
import { defineConfig } from "rolldown";

// `rolldown -c -w` sets both ROLLDOWN_WATCH and ROLLUP_WATCH, a plain
// `rolldown -c` neither. Reading both keeps this working whichever name
// survives; getting it wrong is silent (dev builds minified, production
// builds with sourcemaps).
const dev = !!(process.env.ROLLDOWN_WATCH || process.env.ROLLUP_WATCH);

// MUST be a legal comment, `/*! ... */`. The minifier strips an ordinary `//`
// banner without a word; `comments: { legal: true }` below is the other half.
const banner =
  "/*! Austria Map Card — bundled by Rolldown. Edit sources in src/, then `npm run build`. */";

export default defineConfig({
  input: "src/austria-map-card.ts",
  output: {
    file: "dist/austria-map-card.js",
    format: "es",
    sourcemap: dev,
    banner,
    // One self-contained file for the code. The editor is bundled in; the
    // data chunks are not part of this graph at all (their URL is computed
    // at run time, so Rolldown leaves that import alone).
    codeSplitting: false,
    comments: { legal: true },
    minify: dev
      ? false
      : {
          // Keep console.*: the calls in catch blocks are the card's only
          // client-side failure signal, and the version line tells you which
          // bundle the browser loaded. dropConsole is all-or-nothing.
          compress: { dropConsole: false },
          mangle: true,
          codegen: true,
        },
  },
});
