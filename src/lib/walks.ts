/**
 * The walks the site is built around.
 *
 * Defined here rather than inside the map component so that the server can
 * build a corridor from the same coordinates the map draws. Two copies of a
 * route would drift apart, and the symptom would be posters quietly missing
 * from a walk that looks correct on screen.
 */
export interface Walk {
  /** Matches the route directory under `src/routes/walks/`. */
  slug: string;
  title: string;

  /**
   * The route in walking order, as Leaflet `[lat, lng]` tuples.
   *
   * Tuples because that is what Leaflet wants and this is the data the map
   * consumes directly; anything that needs to do geometry with them converts
   * via `fromLeafletTuples` first, so the ordering is only assumed in one
   * place.
   *
   * These do NOT need densifying for the corridor query — the buffer is
   * measured against the segments between these points, not the points
   * themselves. Densification is purely a matter of how smoothly the map pans.
   */
  coordinates: [number, number][];

  /**
   * How far either side of the route counts as "on this walk", in metres.
   *
   * The one number here worth tuning. Too small and posters drop out because a
   * phone GPS fix is routinely 10–30 m off — the annotator records that error
   * per submission in `accuracy`, and it is frequently larger than you would
   * guess. Too large and the corridor starts collecting the parallel street,
   * which is a different set of posters entirely.
   *
   * 50 m is roughly "somewhere on this street, including the far pavement".
   */
  bufferMeters: number;
}

export const frankfurterAllee: Walk = {
  slug: "frankfurter",
  title: "Frankfurter Allee",
  coordinates: [
    [52.521872, 13.411869],
    [52.522224, 13.412506],
    [52.52106, 13.414911],
    [52.52197, 13.416022],
    [52.521728, 13.41737],
    [52.520182, 13.422436],
    [52.518469, 13.428276],
    [52.51579, 13.454157],
    [52.513495, 13.477016],
    [52.512118, 13.490261],
    [52.511318, 13.499087],
  ],
  bufferMeters: 50,
};

/** Every walk, keyed by slug, for routes that look one up by name. */
export const walks: Record<string, Walk> = {
  [frankfurterAllee.slug]: frankfurterAllee,
};
