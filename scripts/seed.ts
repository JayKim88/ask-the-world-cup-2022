// Seed the 2022 WC snapshot from API-Football → Supabase (PRD §2/§3).
// Run:  pnpm seed   (= tsx --env-file=.env scripts/seed.ts)
// Idempotent + resumable: re-run across days until complete (free tier = 100 req/day).
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (writes bypass RLS) + API_FOOTBALL_KEY.

import { createClient } from "@supabase/supabase-js";

import { apiGet, RateLimitError, WC_LEAGUE_ID, WC_SEASON } from "./lib/api-football";

// ── source response shapes (confirmed via spike 2026-07-18) ──────────────────
interface TeamEntry {
  team: { id: number; name: string; code: string | null };
}
interface StandingRow {
  team: { id: number; name: string };
  group: string; // "Group A"
}
interface SquadEntry {
  players: { id: number; name: string; position: string | null; number: number | null }[];
}
interface FixtureEntry {
  fixture: { id: number; date: string; referee: string | null; venue: { name: string | null; city: string | null } };
  league: { round: string };
  teams: { home: TeamSide; away: TeamSide };
  score: { halftime: Pair; fulltime: Pair; extratime: Pair; penalty: Pair };
}
interface TeamSide { id: number; winner: boolean | null }
interface Pair { home: number | null; away: number | null }
interface StatEntry { team: { id: number }; statistics: { type: string; value: string | number | null }[] }
interface GoalEvent {
  team: { id: number };
  player: { id: number | null };
  assist: { id: number | null };
  time: { elapsed: number | null; extra: number | null };
  type: string;
  detail: string;
}

// ── constants ────────────────────────────────────────────────────────────────
const ROUND_MAP: Record<string, string> = {
  "Group Stage - 1": "group",
  "Group Stage - 2": "group",
  "Group Stage - 3": "group",
  "Round of 16": "ro16",
  "Quarter-finals": "qf",
  "Semi-finals": "sf",
  "3rd Place Final": "third_place",
  Final: "final",
};
const NEXT_ROUND: Record<string, string> = { ro16: "qf", qf: "sf", sf: "final" };
const COUNTABLE_GOAL_DETAILS = new Set(["Normal Goal", "Penalty", "Own Goal"]);

const log = (msg: string): void => void process.stdout.write(`${msg}\n`);

// ── Supabase (service role — build-side, bypasses RLS for writes) ─────────────
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)");
}
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const groupLetterOf = (groupName: string): string => groupName.replace("Group ", "").trim();
const parsePercent = (value: string | number | null): number | null => {
  if (value === null) return null;
  const numeric = parseInt(String(value).replace("%", ""), 10);
  return Number.isNaN(numeric) ? null : numeric;
};
const parseInt0 = (value: string | number | null): number | null => {
  if (value === null) return null;
  const numeric = parseInt(String(value), 10);
  return Number.isNaN(numeric) ? null : numeric;
};

// ── steps ──────────────────────────────────────────────────────────────────
// team id → group letter. Loaded from DB on resume so we don't re-spend API calls.
async function teamGroupsFromDb(): Promise<Map<number, string>> {
  const { data, error } = await db.from("teams").select("id, group_letter");
  if (error) throw new Error(`read teams: ${error.message}`);
  const map = new Map<number, string>();
  for (const r of data ?? []) if (r.group_letter) map.set(r.id as number, r.group_letter as string);
  return map;
}

async function seedTeams(): Promise<Map<number, string>> {
  const existing = await teamGroupsFromDb();
  if (existing.size > 0) {
    log(`✓ teams: ${existing.size} (already seeded — skipping API)`);
    return existing;
  }

  const teamEntries = await apiGet<TeamEntry>("teams", { league: WC_LEAGUE_ID, season: WC_SEASON });
  const standings = await apiGet<{ league: { standings: StandingRow[][] } }>("standings", {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
  });

  const teamToGroup = new Map<number, string>();
  for (const group of standings[0]?.league.standings ?? []) {
    for (const row of group) teamToGroup.set(row.team.id, groupLetterOf(row.group));
  }

  const rows = teamEntries.map((entry) => ({
    id: entry.team.id,
    name: entry.team.name,
    code: entry.team.code,
    group_letter: teamToGroup.get(entry.team.id) ?? null,
  }));
  const { error } = await db.from("teams").upsert(rows);
  if (error) throw new Error(`upsert teams: ${error.message}`);
  log(`✓ teams: ${rows.length}`);
  return teamToGroup;
}

async function seededPlayerTeamIds(): Promise<Set<number>> {
  const { data, error } = await db.from("players").select("team_id");
  if (error) throw new Error(`read players: ${error.message}`);
  return new Set((data ?? []).map((r) => r.team_id as number));
}

async function seedPlayers(teamIds: number[]): Promise<void> {
  const done = await seededPlayerTeamIds();
  const todo = teamIds.filter((id) => !done.has(id));
  if (todo.length === 0) {
    log(`✓ players: ${done.size} squads (already seeded — skipping API)`);
    return;
  }
  for (const teamId of todo) {
    const squads = await apiGet<SquadEntry>("players/squads", { team: teamId });
    const players = squads[0]?.players ?? [];
    const rows = players.map((p) => ({
      id: p.id,
      team_id: teamId,
      name: p.name,
      position: p.position,
      shirt_number: p.number,
    }));
    const { error } = await db.from("players").upsert(rows);
    if (error) throw new Error(`upsert players (team ${teamId}): ${error.message}`);
  }
  log(`✓ players: +${todo.length} squads`);
}

async function seedMatches(teamToGroup: Map<number, string>): Promise<FixtureEntry[]> {
  const fixtures = await apiGet<FixtureEntry>("fixtures", { league: WC_LEAGUE_ID, season: WC_SEASON });
  const rows = fixtures.map((f) => {
    const round = ROUND_MAP[f.league.round] ?? f.league.round;
    const isGroup = round === "group";
    const homeId = f.teams.home.id;
    const etHome = f.score.extratime.home;
    const etAway = f.score.extratime.away;
    const hasEt = etHome !== null && etAway !== null;
    return {
      id: f.fixture.id,
      round,
      group_letter: isGroup ? (teamToGroup.get(homeId) ?? null) : null,
      home_team_id: homeId,
      away_team_id: f.teams.away.id,
      ht_home: f.score.halftime.home, ht_away: f.score.halftime.away,
      ft_home: f.score.fulltime.home, ft_away: f.score.fulltime.away,
      // et = CUMULATIVE post-ET score = fulltime + extratime delta (2-2 + 1-1 → 3-3)
      et_home: hasEt ? (f.score.fulltime.home ?? 0) + (etHome ?? 0) : null,
      et_away: hasEt ? (f.score.fulltime.away ?? 0) + (etAway ?? 0) : null,
      pen_home: f.score.penalty.home, pen_away: f.score.penalty.away,
      winner_team_id: winnerIdOf(f),
      venue: f.fixture.venue.name,
      city: f.fixture.venue.city,
      referee: f.fixture.referee,
      kickoff_at: f.fixture.date,
      next_match_id: null as number | null,
    };
  });
  const { error } = await db.from("matches").upsert(rows);
  if (error) throw new Error(`upsert matches: ${error.message}`);
  log(`✓ matches: ${rows.length}`);
  return fixtures;
}

const winnerIdOf = (f: FixtureEntry): number | null =>
  f.teams.home.winner === true ? f.teams.home.id : f.teams.away.winner === true ? f.teams.away.id : null;

// Point a knockout match at the next-round match its winner advanced to.
async function linkOne(f: FixtureEntry, nextMatches: FixtureEntry[]): Promise<void> {
  const winnerId = winnerIdOf(f);
  if (winnerId === null) return;
  const target = nextMatches.find((m) => m.teams.home.id === winnerId || m.teams.away.id === winnerId);
  if (!target) return;
  const { error } = await db.from("matches").update({ next_match_id: target.fixture.id }).eq("id", f.fixture.id);
  if (error) throw new Error(`link bracket (${f.fixture.id}): ${error.message}`);
}

// Bracket edges: each knockout winner feeds exactly one next-round match.
async function linkBracket(fixtures: FixtureEntry[]): Promise<void> {
  const byRound = new Map<string, FixtureEntry[]>();
  for (const f of fixtures) {
    const round = ROUND_MAP[f.league.round] ?? f.league.round;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round)!.push(f);
  }
  for (const [round, nextRound] of Object.entries(NEXT_ROUND)) {
    const nextMatches = byRound.get(nextRound) ?? [];
    for (const f of byRound.get(round) ?? []) await linkOne(f, nextMatches);
  }
  log("✓ bracket edges linked");
}

async function alreadySeededMatchIds(table: "match_stats" | "goals"): Promise<Set<number>> {
  const { data, error } = await db.from(table).select("match_id");
  if (error) throw new Error(`read ${table}: ${error.message}`);
  return new Set((data ?? []).map((r) => r.match_id as number));
}

function statRow(matchId: number, s: StatEntry) {
  const get = (type: string) => s.statistics.find((x) => x.type === type)?.value ?? null;
  return {
    match_id: matchId,
    team_id: s.team.id,
    possession: parsePercent(get("Ball Possession")),
    shots_total: parseInt0(get("Total Shots")),
    shots_on: parseInt0(get("Shots on Goal")),
    shots_off: parseInt0(get("Shots off Goal")),
    shots_blocked: parseInt0(get("Blocked Shots")),
    corners: parseInt0(get("Corner Kicks")),
    fouls: parseInt0(get("Fouls")),
    offsides: parseInt0(get("Offsides")),
    yellow_cards: parseInt0(get("Yellow Cards")),
    red_cards: parseInt0(get("Red Cards")),
    gk_saves: parseInt0(get("Goalkeeper Saves")),
    passes_total: parseInt0(get("Total passes")),
    passes_pct: parsePercent(get("Passes %")),
  };
}

function goalRow(matchId: number, e: GoalEvent) {
  // API-Football already credits an own goal to the beneficiary team (event.team) —
  // verified with 2022 CAN–MAR: Aguerd (MAR player) OG is credited to Canada.
  // So use event.team as-is; do NOT flip. scorer_player_id still points at the
  // player who scored it (his own team is derivable via players.team_id).
  const detail = e.detail === "Own Goal" ? "owngoal" : e.detail === "Penalty" ? "penalty" : "normal";
  return {
    match_id: matchId,
    team_id: e.team.id,
    scorer_player_id: e.player.id,
    assist_player_id: e.assist.id,
    minute: (e.time.elapsed ?? 0) + (e.time.extra ?? 0), // include added time (90+N)
    detail,
  };
}

async function upsertStats(matchId: number): Promise<void> {
  const stats = await apiGet<StatEntry>("fixtures/statistics", { fixture: matchId });
  const rows = stats.map((s) => statRow(matchId, s));
  if (rows.length === 0) return;
  const { error } = await db.from("match_stats").upsert(rows);
  if (error) throw new Error(`upsert match_stats (${matchId}): ${error.message}`);
}

async function upsertGoals(f: FixtureEntry): Promise<void> {
  const events = await apiGet<GoalEvent>("fixtures/events", { fixture: f.fixture.id });
  const rows = events
    .filter((e) => e.type === "Goal" && COUNTABLE_GOAL_DETAILS.has(e.detail))
    .map((e) => goalRow(f.fixture.id, e));
  if (rows.length === 0) return;
  const { error } = await db.from("goals").upsert(rows);
  if (error) throw new Error(`upsert goals (${f.fixture.id}): ${error.message}`);
}

// match_stats exists for every played match, so its presence is our single
// "fully processed" marker. Fetch goals BEFORE stats each iteration: once a
// match_stats row is committed, that match's goals were already fetched — this
// stops scoreless (0-0) matches, which never produce a goals row, from being
// re-queried on every resume run (free tier = 100 req/day).
async function seedStatsAndGoals(fixtures: FixtureEntry[]): Promise<void> {
  const done = await alreadySeededMatchIds("match_stats");
  for (const f of fixtures) {
    if (done.has(f.fixture.id)) continue;
    await upsertGoals(f);
    await upsertStats(f.fixture.id);
  }
  log("✓ match_stats + goals");
}

async function main(): Promise<void> {
  try {
    const teamToGroup = await seedTeams();
    await seedPlayers([...teamToGroup.keys()]);
    const fixtures = await seedMatches(teamToGroup);
    await linkBracket(fixtures);
    await seedStatsAndGoals(fixtures);
    log("✅ seed complete");
  } catch (err) {
    if (err instanceof RateLimitError) {
      log(`⏸ daily quota hit — progress saved, re-run tomorrow to resume.\n   (${err.message})`);
      process.exit(0);
    }
    throw err;
  }
}

void main();
