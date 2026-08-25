import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { fetchSubmissionStorageKey } from "$lib/server/db";
import { presignRedirect } from "$lib/server/media";

/**
 * The original, uncropped photo behind one submission.
 *
 * Same signing rules as the crop route. Worth knowing before linking to it
 * from anywhere public: these are the full frames as they came off the phone,
 * so they carry whatever else happened to be in shot — passers-by, number
 * plates, house numbers — which the tight poster crops mostly do not.
 */
export const GET: RequestHandler = async ({ params }) => {
  const key = await fetchSubmissionStorageKey(params.id);
  if (!key) error(404, "no photo for this submission");
  return presignRedirect(key);
};
