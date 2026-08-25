import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "./env";

let client: S3Client | null = null;

/**
 * Backblaze B2 through its S3-compatible API — the same bucket the annotator
 * uploads into.
 *
 * Read-only by construction: only `GetObjectCommand` is imported, so adding a
 * write to this app means consciously importing the command that performs it,
 * rather than one autocomplete away. The credentials should be read-only too
 * (see `.env.example`), but the code should not depend on that being true.
 *
 * Built lazily so a missing credential surfaces on the first request rather
 * than crashing the whole server at import time.
 */
function b2(): S3Client {
  if (client) return client;

  client = new S3Client({
    endpoint: requireEnv("B2_ENDPOINT"),
    region: requireEnv("B2_REGION"),
    credentials: {
      accessKeyId: requireEnv("B2_KEY_ID"),
      secretAccessKey: requireEnv("B2_APPLICATION_KEY"),
    },
    // Only affects requests that carry a body, so it changes nothing for the
    // signed GETs below. Kept anyway: the AWS SDK sends CRC32 integrity
    // headers by default, Backblaze rejects some of them, and the resulting
    // "Unsupported header" error looks nothing like a checksum problem. If a
    // write is ever added here, that afternoon should not have to be spent
    // twice.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  return client;
}

/** Minutes a signed image URL stays valid once handed to the browser. */
const DOWNLOAD_WINDOW_SECONDS = 5 * 60;

/**
 * A short-lived URL the browser can fetch one stored object from.
 *
 * The bucket stays private: nothing is publicly readable, and every image the
 * site shows is a URL minted here for that one object and expiring shortly
 * after.
 */
export function presignDownload(key: string): Promise<string> {
  return getSignedUrl(
    b2(),
    new GetObjectCommand({ Bucket: requireEnv("B2_BUCKET"), Key: key }),
    {
      expiresIn: DOWNLOAD_WINDOW_SECONDS,
    },
  );
}
