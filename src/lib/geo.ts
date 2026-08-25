import type { LatLng } from "$lib/types";

/**
 * Corridor geometry for the walks: how far a point sits from a route, and the
 * cheap bounding box that precedes the exact test.
 *
 * No database and no credentials in this file on purpose. It is arithmetic, so
 * it is testable on its own without a Supabase connection, and it lives outside
 * `src/lib/server/` so the map can run the very same corridor test in the
 * browser as the walk advances.
 */

/**
 * Metres per degree of latitude.
 *
 * Effectively constant everywhere, because lines of latitude are evenly spaced.
 * (Longitude has no such luck — see below.) 111_320 is the mean value; the true
 * figure varies by roughly 0.6% between equator and pole because the Earth is
 * flattened, which is an order of magnitude below the error of a phone GPS fix.
 */
const METRES_PER_DEGREE_LATITUDE = 111_320;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Metres spanned by one degree of longitude at a given latitude.
 *
 * Scaled by cos(latitude): at the equator a degree of longitude is as long as a
 * degree of latitude, while at 52.5°N — Berlin — it is only about 61% as long,
 * because the meridians have converged that much on their way to the pole.
 *
 * This is why a bounding box that is "square" in metres around a Berlin walk is
 * markedly wider than it is tall when written in degrees.
 */
function metresPerDegreeLongitude(latitude: number): number {
  return METRES_PER_DEGREE_LATITUDE * Math.cos(latitude * DEGREES_TO_RADIANS);
}

/** A point in a local, flat, metres-based frame. Not geographic. */
interface PlanarPoint {
  x: number;
  y: number;
}

/**
 * Project a geographic point onto a flat plane measured in metres, centred on
 * `origin`.
 *
 * This is an equirectangular projection: the cheapest one that keeps distances
 * honest, and comfortably accurate at this scale. It pretends the ground is
 * flat, an error that grows with distance from the origin but stays under about
 * 0.1% within ~10 km — centimetres across a city walk, measured against GPS
 * fixes that are themselves good to a few metres at best.
 *
 * Projecting first is what makes the point-to-segment maths below tractable.
 * The spherical equivalent (cross-track distance, via great-circle bearings) is
 * substantially more code and more ways to be subtly wrong, for an answer that
 * would differ by less than the width of the pavement the poster is standing on.
 */
function toPlane(point: LatLng, origin: LatLng): PlanarPoint {
  return {
    x:
      (point.longitude - origin.longitude) *
      metresPerDegreeLongitude(origin.latitude),
    y: (point.latitude - origin.latitude) * METRES_PER_DEGREE_LATITUDE,
  };
}

/**
 * Distance in metres from `point` to the line *segment* ab.
 *
 * Not to the infinite line through a and b, and not to whichever of a or b
 * happens to be closer. That distinction matters more than it first looks.
 *
 * Testing a poster only against the walk's recorded vertices would make the
 * answer depend on how finely the route happens to be sampled: with vertices
 * 200 m apart, a poster sitting 40 m from the midpoint of a straight stretch is
 * about 107 m from the nearest vertex, so a 50 m buffer would silently drop it.
 * Densifying the path makes that error smaller but never removes it, and it
 * ties a correctness property to a cosmetic setting. Measuring against the
 * segment itself gives the same answer however coarsely the path is drawn.
 */
function distanceToSegment(
  point: PlanarPoint,
  a: PlanarPoint,
  b: PlanarPoint,
): number {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const apX = point.x - a.x;
  const apY = point.y - a.y;

  // |ab|². Kept squared: the comparison below does not need the square root,
  // and skipping it avoids a pointless call per segment.
  const segmentLengthSquared = abX * abX + abY * abY;

  // Where the foot of the perpendicular falls along ab, as a fraction: 0 is a,
  // 1 is b. That is the projection of ap onto ab, i.e. (ap·ab) / |ab|².
  //
  // A zero-length segment — a vertex repeated in the route — would divide by
  // zero here, so it collapses to "measure against a" instead.
  const alongSegment =
    segmentLengthSquared === 0
      ? 0
      : (apX * abX + apY * abY) / segmentLengthSquared;

  // Clamping to [0, 1] is precisely what turns the infinite line into the
  // segment: beyond either end, the nearest point of the segment is its endpoint.
  const clamped = Math.max(0, Math.min(1, alongSegment));

  const closestX = a.x + clamped * abX;
  const closestY = a.y + clamped * abY;

  return Math.hypot(point.x - closestX, point.y - closestY);
}

/**
 * Distance in metres from a point to the nearest point anywhere on a walk.
 *
 * `path` is the route's coordinates in order. A single-point path is allowed
 * and means "distance to that point" — which is what lets this same function
 * answer a plain radius around one location as well as a corridor along a whole
 * route.
 *
 * Cost is one pass over the segments per call. With a route of a few hundred
 * vertices and a collection of a few hundred submissions that is a few tens of
 * thousands of arithmetic operations: far too small to be worth caching the
 * projected path for.
 */
export function distanceToPathMeters(point: LatLng, path: LatLng[]): number {
  // No route means nothing can be near it. Infinity rather than 0, so that a
  // caller filtering on `<= radius` gets an empty result rather than everything.
  if (path.length === 0) return Infinity;

  // Every point is projected relative to the same origin — the walk's first
  // vertex — so all the planar coordinates share one frame and stay comparable.
  const origin = path[0];
  const target = toPlane(point, origin);

  // A one-point route has no segments to walk; the origin *is* the route.
  if (path.length === 1) return Math.hypot(target.x, target.y);

  let nearest = Infinity;
  for (let index = 0; index < path.length - 1; index++) {
    const a = toPlane(path[index], origin);
    const b = toPlane(path[index + 1], origin);
    nearest = Math.min(nearest, distanceToSegment(target, a, b));
  }
  return nearest;
}

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

/**
 * The latitude/longitude box guaranteed to contain every point within
 * `radiusMeters` of the walk.
 *
 * This is the cheap first stage of the two-stage filter: it is expressible as
 * four plain `>=`/`<=` comparisons, which Postgres can answer from an index,
 * whereas the exact corridor test cannot be written in SQL at all without
 * PostGIS.
 *
 * A box is not a corridor, so this lets through submissions sitting near its
 * *corners* that the exact test will then reject. That is the whole bargain:
 * it can only ever over-select, never miss, which is the property that makes
 * skipping straight to a coarse filter safe.
 *
 * NOT handled: a walk that crosses the antimeridian (±180° longitude), which
 * would need the box split into two, or one reaching a pole, where the
 * longitude padding diverges. The collection is in Berlin. Rather than ship
 * untested code for cases that cannot arise, this fails the honest way — it
 * does not pretend to cover them.
 */
export function boundingBoxAround(
  path: LatLng[],
  radiusMeters: number,
): BoundingBox {
  if (path.length === 0) {
    throw new Error("boundingBoxAround needs at least one coordinate");
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    throw new Error(
      `boundingBoxAround needs a non-negative radius, got ${radiusMeters}`,
    );
  }

  let minLatitude = Infinity;
  let maxLatitude = -Infinity;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;

  for (const point of path) {
    minLatitude = Math.min(minLatitude, point.latitude);
    maxLatitude = Math.max(maxLatitude, point.latitude);
    minLongitude = Math.min(minLongitude, point.longitude);
    maxLongitude = Math.max(maxLongitude, point.longitude);
  }

  const latitudePadding = radiusMeters / METRES_PER_DEGREE_LATITUDE;

  // Pad longitude using the latitude furthest from the equator, where the
  // meridians are closest together and one metre therefore spans the most
  // longitude. Padding by the widest factor the walk encounters means every
  // other part of it is padded generously rather than short — erring, again,
  // towards over-selecting.
  const widestLatitude = Math.max(Math.abs(minLatitude), Math.abs(maxLatitude));
  const longitudePadding =
    radiusMeters / metresPerDegreeLongitude(widestLatitude);

  return {
    // Clamped, because padding near a pole would otherwise push the box past
    // the end of the coordinate system and Postgres would reject the filter.
    minLatitude: Math.max(-90, minLatitude - latitudePadding),
    maxLatitude: Math.min(90, maxLatitude + latitudePadding),
    minLongitude: Math.max(-180, minLongitude - longitudePadding),
    maxLongitude: Math.min(180, maxLongitude + longitudePadding),
  };
}

/**
 * Convert Leaflet's `[lat, lng]` tuples into named points.
 *
 * The walk in the map component is written as Leaflet tuples, and this is the
 * one place that ordering is allowed to be assumed. Everything downstream deals
 * in named fields, so the assumption cannot leak.
 */
export function fromLeafletTuples(coordinates: [number, number][]): LatLng[] {
  return coordinates.map(([latitude, longitude]) => ({ latitude, longitude }));
}
