import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { fetchPosterCropKey } from "$lib/server/db";
import { presignRedirect } from "$lib/server/media";

/**
 * The cropped image for one poster, as `<img src="/media/crop/{id}">`.
 *
 * The bucket is private, so this is how an image reaches the page at all: the
 * id is looked up, the object key comes from the row, and a URL is signed for
 * that one object. The client never names the object it wants, which is what
 * stops this becoming a way to read the whole bucket.
 *
 * A missing crop and an unparseable id both land on 404 — see `fetchPosterCropKey`.
 */
export const GET: RequestHandler = async ({ params }) => {
  const key = await fetchPosterCropKey(params.id);
  if (!key) error(404, "no crop for this poster");
  return presignRedirect(key);
};
