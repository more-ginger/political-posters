/**
 * Shapes shared between the server modules and the components that render them.
 *
 * Deliberately outside `src/lib/server/`: these are types only, they carry no
 * credentials, and a component that displays a submission needs to be able to
 * name its shape without SvelteKit refusing the import.
 */

/**
 * A geographic point, as named fields rather than a tuple.
 *
 * Leaflet writes `[lat, lng]`; GeoJSON and turf write `[lng, lat]`. Both are
 * bare two-number arrays, so swapping one for the other type-checks perfectly
 * and shows up only as coordinates landing in the wrong place entirely. Naming
 * the fields makes that mistake impossible to write in the first place.
 */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * One poster cropped out of a submission photo.
 *
 * Every field the annotator fills in by hand is nullable, because plenty of
 * posters genuinely carry no name or no slogan — and that is not the same as
 * an empty string.
 */
export interface Poster {
  id: string;
  name: string | null;
  slogan: string | null;
  party: string | null;
  dominantColors: string[];
  /**
   * Whether a cropped image exists for this poster. `crop_storage_key` is
   * nullable — the analysis pass did not always produce one — so the UI has to
   * be able to ask before it links to an image that isn't there.
   */
  hasCrop: boolean;
}

/** One photo, where it was taken, and the posters found in it. */
export interface LocatedSubmission extends LatLng {
  id: string;
  /**
   * GPS confidence radius in metres. Null means the coordinates were typed by
   * hand: precision unknown, NOT precision perfect. Do not coalesce this to 0.
   */
  accuracy: number | null;
  capturedAt: string;
  posters: Poster[];
}

/**
 * A submission matched against a walk, carrying how far off the route it sits.
 *
 * There is no `hasPhoto` counterpart to `Poster.hasCrop` here: `storage_key` is
 * NOT NULL in the annotator's schema, so every submission has an original photo
 * by construction and a flag would always read true.
 */
export interface NearbySubmission extends LocatedSubmission {
  /**
   * Metres from the nearest point anywhere on the walk — not from its nearest
   * recorded vertex. See `distanceToPathMeters` for why the difference matters.
   */
  distanceMeters: number;
}
