// API-Football (api-sports.io) client — build-side seeding only (PRD §3).
// Free tier limits (confirmed live): 100 requests/day AND 10 requests/minute.
// So we space calls ~6.5s apart, and on a per-MINUTE 429 we wait & retry
// (only a per-DAY exhaustion stops the run for the day → RateLimitError).

const BASE_URL = "https://v3.football.api-sports.io";
const HTTP_TOO_MANY_REQUESTS = 429;
const REQUEST_DELAY_MS = 6_500; // < 10/min
const MINUTE_LIMIT_WAIT_MS = 65_000; // wait out a per-minute limit, then retry
const MAX_MINUTE_RETRIES = 6;
export const WC_LEAGUE_ID = 1;
export const WC_SEASON = 2022;

// Raised only when the DAILY quota is exhausted — lets the seeder stop and resume tomorrow.
export class RateLimitError extends Error {}

interface ApiEnvelope<T> {
  response: T[];
  errors: unknown;
  results: number;
}

type RateKind = "minute" | "day" | "none";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (errors: unknown): string => {
  if (Array.isArray(errors)) return errors.length > 0 ? JSON.stringify(errors) : "";
  const isObject = typeof errors === "object" && errors !== null;
  return isObject && Object.keys(errors).length > 0 ? JSON.stringify(errors).toLowerCase() : "";
};

// Distinguish the two throttles: a per-minute cap is transient (wait+retry);
// a per-day cap ends the run. A bare 429 with no body → treat as per-minute (safer).
const classifyRateLimit = (status: number, errors: unknown): RateKind => {
  const text = errorText(errors);
  const mentionsDay = text.includes("per day") || text.includes('"requests"') || text.includes("requests:");
  const mentionsMinute = text.includes("per minute") || text.includes("ratelimit");
  if (mentionsDay) return "day";
  if (mentionsMinute) return "minute";
  if (status === HTTP_TOO_MANY_REQUESTS) return "minute";
  return "none";
};

const otherErrorMessage = (errors: unknown): string | null => {
  const text = errorText(errors);
  return text === "" ? null : text;
};

export async function apiGet<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set (see .env.example)");

  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${BASE_URL}/${path}?${query}`;

  for (let attempt = 0; attempt <= MAX_MINUTE_RETRIES; attempt++) {
    await sleep(REQUEST_DELAY_MS);

    const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

    const kind = classifyRateLimit(res.status, body?.errors);
    if (kind === "day") throw new RateLimitError(`daily quota exhausted on ${path}`);
    if (kind === "minute") {
      await sleep(MINUTE_LIMIT_WAIT_MS); // wait out the per-minute window, then retry
      continue;
    }

    if (body === null) throw new Error(`non-JSON response on ${path} (HTTP ${res.status})`);
    const message = otherErrorMessage(body.errors);
    if (message !== null) throw new Error(`API error on ${path}: ${message}`); // never swallow
    return body.response;
  }
  throw new Error(`rate-limit retries exhausted on ${path}`);
}
