import type { PageServerLoad } from "./$types";
import { fetchSubmissionsNearPath } from "$lib/server/db";
import { fromLeafletTuples } from "$lib/geo";
import { frankfurterAllee } from "$lib/walks";

/**
 * Everything on this walk, fetched once when the page loads.
 *
 * One query for the whole corridor rather than one per step: the walk then pans
 * through data the browser already holds, with no network round trip on each
 * click. At the size of this collection the entire corridor is a few hundred
 * rows, which is far cheaper to send once than to re-request repeatedly.
 *
 * Deliberately not wrapped in a try/catch. If Supabase is unreachable or a
 * credential is missing, an error page saying so is more useful than a map that
 * renders perfectly with no posters on it — the second is indistinguishable
 * from a walk where nothing was found.
 */
export const load: PageServerLoad = async () => {
  const walk = frankfurterAllee;

  return {
    walk,
    submissions: await fetchSubmissionsNearPath(
      fromLeafletTuples(walk.coordinates),
      walk.bufferMeters,
    ),
  };
};
