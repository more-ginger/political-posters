import { presignDownload } from "./storage";

/**
 * Redirect to a freshly signed URL for one stored object.
 *
 * Signed on demand rather than in bulk at page load: a browsing session
 * outlasts any sensible signature lifetime, so URLs minted up front go dead
 * while the page is still open — and the ones that break are exactly the images
 * not looked at yet.
 *
 * Callers resolve the key from a row id rather than accepting it from the
 * client, so this cannot be used to sign arbitrary objects in the bucket.
 */
export async function presignRedirect(key: string): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: {
      location: await presignDownload(key),
      // The target expires, so the redirect must not be cached past it.
      "cache-control": "no-store",
    },
  });
}
