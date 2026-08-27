import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";
import { boundingBoxAround, distanceToPathMeters } from "$lib/geo";
import type {
  LatLng,
  LocatedSubmission,
  NearbySubmission,
  Poster,
} from "$lib/types";

let client: SupabaseClient | null = null;

/**
 * Supabase with a secret key (`sb_secret_...`), the replacement for the legacy
 * JWT `service_role` key.
 *
 * It still maps to the `service_role` Postgres role and still bypasses RLS, so
 * it must never reach the browser — hence `src/lib/server/`, which SvelteKit
 * refuses to bundle into client code.
 *
 * A publishable key would not work here even though this app only reads:
 * `submissions` and `analyzed_posters` have row-level security enabled with no
 * policies attached, so an anon key can read nothing at all. That is the
 * annotator's design and a good one — the data is only ever reachable through
 * a server this project controls.
 *
 * This module is read-only. It contains no insert, update or delete, and it
 * should stay that way: the annotator owns this data, and two apps writing the
 * same rows is how a collection gets quietly corrupted.
 */
function db(): SupabaseClient {
  if (client) return client;

  client = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  return client;
}

/**
 * Columns read from each table, named explicitly rather than `select('*')`.
 *
 * The annotator owns this schema and will keep changing it. An explicit list
 * means a new column arrives here as a deliberate edit, instead of silently
 * riding along on every request — `original_result` in particular holds the
 * whole raw analysis payload, which this app never shows and should not ship
 * over the wire once per poster.
 */
const SUBMISSION_COLUMNS = "id,latitude,longitude,accuracy,captured_at";
const POSTER_COLUMNS =
  "id,submission_id,name,slogan,party,dominant_colors,crop_storage_key, box";

/** The submission columns as they come back from PostgREST, before renaming. */
interface RawSubmission {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
}

interface RawPoster {
  id: string;
  submission_id: string;
  name: string | null;
  slogan: string | null;
  party: string | null;
  dominant_colors: string[] | null;
  crop_storage_key: string | null;
  box: {}
}

export interface ReadOptions {
  /**
   * Include posters the annotator has not reviewed yet.
   *
   * Off by default, and that default is the cautious one rather than the
   * convenient one. An unreviewed row still carries the unedited output of the
   * analysis pass — including the party it guessed and the name it read off
   * the poster — and this app publishes what it is handed. Turn this on for
   * debugging, not for the public site.
   */
  includeUnreviewed?: boolean;
}

/**
 * The posters belonging to a set of submissions, grouped by submission id.
 *
 * Fetched as a second query and joined in memory rather than as a nested
 * PostgREST select: at this size that is cheaper to reason about, and it keeps
 * the shape this app wants independent of how the two tables are related.
 *
 * The id list travels in the query string, so a large enough collection would
 * eventually meet the server's URL length limit and come back as a 414. A few
 * thousand submissions is comfortably inside it; a few hundred thousand would
 * need paging. Written down so that day is a known boundary rather than a
 * mystery.
 */
async function fetchPostersBySubmission(
  submissionIds: string[],
  options: ReadOptions,
): Promise<Map<string, Poster[]>> {
  if (submissionIds.length === 0) return new Map();

  let query = db()
    .from("analyzed_posters")
    .select(POSTER_COLUMNS)
    .in("submission_id", submissionIds);

  if (!options.includeUnreviewed) query = query.eq("reviewed", true);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase select failed: ${error.message}`, {
      cause: error,
    });
  }

  const grouped = new Map<string, Poster[]>();
  for (const row of (data ?? []) as RawPoster[]) {
    const posters = grouped.get(row.submission_id) ?? [];
    posters.push({
      id: row.id,
      name: row.name,
      slogan: row.slogan,
      party: row.party,
      // Null means the column was never filled in; an empty list is the same
      // thing to a caller that just wants to render the colours.
      dominantColors: row.dominant_colors ?? [],
      hasCrop: row.crop_storage_key !== null,
      box: row.box
    });
    grouped.set(row.submission_id, posters);
  }
  return grouped;
}

/** Attach each submission's posters and rename the columns to this app's shape. */
function toLocatedSubmissions(
  rows: RawSubmission[],
  posters: Map<string, Poster[]>,
): LocatedSubmission[] {
  return rows.map((row) => ({
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    capturedAt: row.captured_at,
    posters: posters.get(row.id) ?? [],
  }));
}

/**
 * Every located submission in the collection, oldest first.
 *
 * `captured_at` alone is not a total order — submissions recorded in the same
 * second exist — and Postgres may return tied rows in any order it likes. The
 * id tiebreaker makes the sequence stable across reloads, which matters as soon
 * as anything in the UI counts positions ("poster 12 of 340").
 */
export async function fetchSubmissions(
  options: ReadOptions = {},
): Promise<LocatedSubmission[]> {
  const { data, error } = await db()
    .from("submissions")
    .select(SUBMISSION_COLUMNS)
    .order("captured_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Supabase select failed: ${error.message}`, {
      cause: error,
    });
  }

  const rows = (data ?? []) as RawSubmission[];
  const posters = await fetchPostersBySubmission(
    rows.map((row) => row.id),
    options,
  );
  return toLocatedSubmissions(rows, posters);
}

/**
 * Every submission within `radiusMeters` of a walk, nearest to the route first.
 *
 * Two stages, because the exact test cannot be expressed in SQL without adding
 * PostGIS to a database this app does not own:
 *
 *   1. In Postgres — a bounding box around the whole route, padded by the
 *      radius. Four plain comparisons on `latitude` and `longitude`, which can
 *      only over-select and never miss (see `boundingBoxAround`).
 *   2. In JS — the exact corridor test on whatever stage 1 returned, discarding
 *      the box's corners and recording each survivor's true distance from the
 *      route.
 *
 * One box around the entire walk rather than one query per step: the whole
 * corridor arrives in a single round trip at page load, and the walk then pans
 * through data it already has, with no network on each click.
 *
 * `path` is the route in order — the same coordinates the map draws. It does
 * not need to be densified for this: the corridor is measured against the
 * segments between the vertices, not the vertices themselves, so adding
 * in-between points changes nothing about which submissions come back.
 */
export async function fetchSubmissionsNearPath(
  path: LatLng[],
  radiusMeters: number,
  options: ReadOptions = {},
): Promise<NearbySubmission[]> {
  if (path.length === 0) {
    throw new Error("fetchSubmissionsNearPath needs at least one coordinate");
  }
  // Validated rather than quietly returning nothing: a negative or NaN radius
  // is a bug in the caller, and an empty result would hide it as "no posters
  // on this walk".
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    throw new Error(
      `fetchSubmissionsNearPath needs a non-negative radius, got ${radiusMeters}`,
    );
  }

  const box = boundingBoxAround(path, radiusMeters);

  const { data, error } = await db()
    .from("submissions")
    .select(SUBMISSION_COLUMNS)
    .gte("latitude", box.minLatitude)
    .lte("latitude", box.maxLatitude)
    .gte("longitude", box.minLongitude)
    .lte("longitude", box.maxLongitude);

  if (error) {
    throw new Error(`Supabase select failed: ${error.message}`, {
      cause: error,
    });
  }

  // Stage 2. Distance is computed once per row and carried through, so nothing
  // downstream has to recompute it to sort or to label.
  const nearby: { row: RawSubmission; distanceMeters: number }[] = [];
  for (const row of (data ?? []) as RawSubmission[]) {
    const distanceMeters = distanceToPathMeters(
      { latitude: row.latitude, longitude: row.longitude },
      path,
    );
    if (distanceMeters <= radiusMeters) nearby.push({ row, distanceMeters });
  }

  // Nearest first, with the id as a tiebreaker for the same reason as above:
  // two posters on opposite sides of the same street tie exactly often enough
  // to make an unstable order visible.
  nearby.sort(
    (a, b) =>
      a.distanceMeters - b.distanceMeters || a.row.id.localeCompare(b.row.id),
  );

  const posters = await fetchPostersBySubmission(
    nearby.map((match) => match.row.id),
    options,
  );

  return toLocatedSubmissions(
    nearby.map((match) => match.row),
    posters,
  ).map((submission, index) => ({
    ...submission,
    distanceMeters: nearby[index].distanceMeters,
  }));
}

/**
 * Whether a string is shaped like a Postgres uuid.
 *
 * Guarded at this layer rather than in each route, so a future route cannot
 * forget it. Both id columns are `uuid`, and comparing one against a string
 * Postgres cannot parse raises `invalid input syntax for type uuid` — which
 * would surface as a 500 for what is really "no such row". These ids arrive
 * straight from the URL, so that is a shape a visitor can trigger at will.
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * The stored object key for one poster's crop, or null when there is none.
 *
 * Exists so a route can turn a poster id into a signed image URL without ever
 * letting the client name the object it wants.
 */
export async function fetchPosterCropKey(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;

  const { data, error } = await db()
    .from("analyzed_posters")
    .select("crop_storage_key")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase select failed: ${error.message}`, {
      cause: error,
    });
  }
  return data?.crop_storage_key ?? null;
}

/** The original photo's object key, for the same purpose. */
export async function fetchSubmissionStorageKey(
  id: string,
): Promise<string | null> {
  if (!isUuid(id)) return null;

  const { data, error } = await db()
    .from("submissions")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase select failed: ${error.message}`, {
      cause: error,
    });
  }
  return data?.storage_key ?? null;
}
