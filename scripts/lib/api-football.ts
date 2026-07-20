// API-Football (api-sports.io) client — build-side seeding only (PRD §3).
// Free tier: season 2022, 100 req/day. Confirmed shapes via spike (2026-07-18).

const BASE_URL = "https://v3.football.api-sports.io";
const HTTP_TOO_MANY_REQUESTS = 429;
const REQUEST_DELAY_MS = 300; // ~3 req/s — stay under the free tier's per-minute burst cap
export const WC_LEAGUE_ID = 1;
export const WC_SEASON = 2022;

// Raised when the free daily quota is exhausted — lets the seeder stop and resume.
export class RateLimitError extends Error {}

interface ApiEnvelope<T> {
  response: T[];
  errors: unknown;
  results: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// API-Football returns errors as [] (ok) or an object {key: message} (error).
const apiErrorMessage = (errors: unknown): string | null => {
  if (Array.isArray(errors)) return errors.length > 0 ? JSON.stringify(errors) : null;
  const isObject = typeof errors === "object" && errors !== null;
  if (isObject && Object.keys(errors).length > 0) return JSON.stringify(errors);
  return null;
};

const isRateLimit = (errors: unknown): boolean => {
  const isObject = typeof errors === "object" && errors !== null && !Array.isArray(errors);
  if (!isObject) return false;
  const record = errors as Record<string, unknown>;
  return "requests" in record || "rateLimit" in record;
};

export async function apiGet<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set (see .env.example)");

  await sleep(REQUEST_DELAY_MS); // throttle every call at the single choke point

  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${BASE_URL}/${path}?${query}`;

  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (res.status === HTTP_TOO_MANY_REQUESTS) throw new RateLimitError(`429 on ${path}`);

  const body = (await res.json()) as ApiEnvelope<T>;

  const message = apiErrorMessage(body.errors);
  if (message !== null) {
    if (isRateLimit(body.errors)) throw new RateLimitError(`quota exhausted on ${path}: ${message}`);
    throw new Error(`API error on ${path}: ${message}`); // never swallow — surface it
  }
  return body.response;
}
