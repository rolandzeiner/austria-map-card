/**
 * Loading the map data, one chunk at a time, when it is first needed.
 *
 * A Lovelace resource is loaded on every dashboard, whether a map is on it
 * or not, so the card's own file holds no geometry. Each chunk is an ES
 * module beside it, fetched with a dynamic `import()` whose URL is worked
 * out from the card's own (`import.meta.url`), and each is asked for at
 * most once per page: the result is kept, and every card on the page reads
 * from the same store.
 */
import { CHUNK_IDS, DATA_FORMAT, chunkFile, type Chunk, type ChunkId } from "../data/format.ts";
import { MapStore } from "./store.ts";

/**
 * - `idle`: not asked for yet.
 * - `failed`: the import was rejected (offline, a 404). `retry()` asks again.
 * - `outdated`: the file is not in the format this card reads. The browser
 *   holds files of two versions; only reloading the page fixes that.
 */
export type ChunkState = "idle" | "loading" | "ready" | "failed" | "outdated";

export type Importer = (url: string) => Promise<unknown>;

export interface LoaderOptions {
  /** URL of the card's own module; the chunks lie beside it. */
  readonly base: string;
  /** The card version, as a cache key: a new card never reads an old chunk. */
  readonly version: string;
  readonly importer?: Importer;
}

// The URL is only known at run time, which also keeps the bundler from
// trying to follow it.
const importModule: Importer = (url) => import(/* @vite-ignore */ url);

export class ChunkLoader {
  public readonly store: MapStore;
  private readonly states = new Map<ChunkId, ChunkState>();
  private readonly attempts = new Map<ChunkId, number>();
  private readonly listeners = new Set<() => void>();
  private readonly base: string;
  private readonly version: string;
  private readonly importer: Importer;

  public constructor(store: MapStore, options: LoaderOptions) {
    this.store = store;
    this.base = options.base;
    this.version = options.version;
    this.importer = options.importer ?? importModule;
  }

  public state(id: ChunkId): ChunkState {
    return this.states.get(id) ?? "idle";
  }

  /** The address a chunk is imported from. */
  public url(id: ChunkId): string {
    const attempt = this.attempts.get(id) ?? 0;
    // A failed import can be remembered by the browser for the life of the
    // page; a changed URL makes the retry a new request.
    const retry = attempt > 0 ? `&retry=${attempt}` : "";
    return new URL(`${chunkFile(id)}?v=${encodeURIComponent(this.version)}${retry}`, this.base).href;
  }

  /** Start loading whichever of these chunks have not been asked for yet. */
  public request(ids: Iterable<ChunkId>): void {
    for (const id of ids) {
      if (this.state(id) === "idle") void this.load(id);
    }
  }

  /** Ask again for everything that failed. */
  public retry(): void {
    for (const id of CHUNK_IDS) {
      if (this.state(id) !== "failed") continue;
      this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
      this.states.set(id, "idle");
      void this.load(id);
    }
  }

  public get failed(): ChunkId[] {
    return CHUNK_IDS.filter((id) => this.state(id) === "failed");
  }

  public get outdated(): boolean {
    return CHUNK_IDS.some((id) => this.state(id) === "outdated");
  }

  public get loading(): boolean {
    return CHUNK_IDS.some((id) => this.state(id) === "loading");
  }

  /** Be told whenever a chunk arrives or fails. Returns the way to unsubscribe. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async load(id: ChunkId): Promise<void> {
    this.set(id, "loading");
    let module: unknown;
    try {
      module = await this.importer(this.url(id));
    } catch (error) {
      console.warn(`[austria-map-card] map data "${id}" did not load`, error);
      this.set(id, "failed");
      return;
    }
    const chunk = (module as { default?: Partial<Chunk> } | null)?.default;
    if (chunk === undefined || chunk === null || chunk.format !== DATA_FORMAT || chunk.id !== id) {
      console.warn(
        `[austria-map-card] map data "${id}" is in format ${String(chunk?.format)}, this card reads ${DATA_FORMAT}`,
      );
      this.set(id, "outdated");
      return;
    }
    try {
      this.store.add(chunk as Chunk);
    } catch (error) {
      console.error(`[austria-map-card] map data "${id}" could not be read`, error);
      this.set(id, "outdated");
      return;
    }
    this.set(id, "ready");
  }

  private set(id: ChunkId, state: ChunkState): void {
    this.states.set(id, state);
    for (const listener of [...this.listeners]) listener();
  }
}

let shared: ChunkLoader | undefined;

/** The page's one loader and store: two map cards share their data. */
export function sharedLoader(options: LoaderOptions): ChunkLoader {
  shared ??= new ChunkLoader(new MapStore(), options);
  return shared;
}
