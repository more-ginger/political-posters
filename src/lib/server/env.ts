import { env } from "$env/dynamic/private";

/**
 * Read a required secret, failing loudly rather than at the first query.
 *
 * Deliberately `$env/dynamic/private`: these are read at runtime, so the app
 * still builds on a machine that has no credentials (CI, a fresh clone).
 */
export function requireEnv(name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name} — see .env.example`);
  }
  return value;
}
