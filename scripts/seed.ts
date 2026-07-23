// Seed the 2022 WC snapshot from API-Football → local SQLite (PRD §2/§3).
// Run:  pnpm seed   (= tsx --env-file=.env scripts/seed.ts)
// Produces db/worldcup.db. Idempotent + resumable (free tier = 10 req/min, 100/day).
// Needs only API_FOOTBALL_KEY. The DB is a fixed read-only snapshot; the app opens
// it read-only, so no roles/RLS/RPC are needed.

import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { apiGet, RateLimitError, WC_LEAGUE_ID, WC_SEASON } from "./lib/api-football";

// ── source response shapes (confirmed via spike 2026-07-18) ──────────────────
interface TeamEntry { team: { id: number; name: string; code: string | null } }
interface StandingRow { team: { id: number; name: string }; group: string }
interface SquadEntry { players: { id: number; name: string; position: string | null; number: number | null }[] }
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
  comments: string | null; // "Penalty Shootout" marks a shootout kick (not a match goal)
}
interface PlayerByIdEntry {
  player: { id: number; name: string };
  statistics: { games: { position: string | null } }[];
}
interface OrphanPlayer {
  pid: number;
  team_id: number;
}

// ── constants ────────────────────────────────────────────────────────────────
const DB_PATH = "db/worldcup.db";
const SCHEMA_PATH = "db/schema.sql";
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
const SHOOTOUT_COMMENT = "Penalty Shootout"; // shootout kicks are not match goals

const log = (msg: string): void => void process.stdout.write(`${msg}\n`);

// ── SQLite (build-side writes; app reads the same file read-only) ─────────────
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON"); // default rollback journal keeps the .db a single committable file
db.exec(readFileSync(SCHEMA_PATH, "utf8"));

// ── prepared statements ──────────────────────────────────────────────────────
const upsertTeam = db.prepare(
  `insert into teams (id, name, code, group_letter) values (@id, @name, @code, @group_letter)
   on conflict(id) do update set name=@name, code=@code, group_letter=@group_letter`,
);
const upsertPlayer = db.prepare(
  `insert into players (id, team_id, name, position, shirt_number)
   values (@id, @team_id, @name, @position, @shirt_number)
   on conflict(id) do update set team_id=@team_id, name=@name, position=@position, shirt_number=@shirt_number`,
);
const upsertMatch = db.prepare(
  `insert into matches (id, round, group_letter, home_team_id, away_team_id, ht_home, ht_away,
     ft_home, ft_away, et_home, et_away, pen_home, pen_away, winner_team_id, venue, city, referee, kickoff_at)
   values (@id, @round, @group_letter, @home_team_id, @away_team_id, @ht_home, @ht_away,
     @ft_home, @ft_away, @et_home, @et_away, @pen_home, @pen_away, @winner_team_id, @venue, @city, @referee, @kickoff_at)
   on conflict(id) do update set round=@round, group_letter=@group_letter, home_team_id=@home_team_id,
     away_team_id=@away_team_id, ht_home=@ht_home, ht_away=@ht_away, ft_home=@ft_home, ft_away=@ft_away,
     et_home=@et_home, et_away=@et_away, pen_home=@pen_home, pen_away=@pen_away, winner_team_id=@winner_team_id,
     venue=@venue, city=@city, referee=@referee, kickoff_at=@kickoff_at`, // next_match_id preserved (set by linkBracket)
);
const setNextMatch = db.prepare(`update matches set next_match_id=@next where id=@id`);
const upsertStat = db.prepare(
  `insert into match_stats (match_id, team_id, possession, shots_total, shots_on, shots_off, shots_blocked,
     corners, fouls, offsides, yellow_cards, red_cards, gk_saves, passes_total, passes_pct)
   values (@match_id, @team_id, @possession, @shots_total, @shots_on, @shots_off, @shots_blocked,
     @corners, @fouls, @offsides, @yellow_cards, @red_cards, @gk_saves, @passes_total, @passes_pct)
   on conflict(match_id, team_id) do nothing`,
);
const deleteGoals = db.prepare(`delete from goals where match_id=@match_id`);
const insertGoal = db.prepare(
  `insert into goals (match_id, team_id, scorer_player_id, assist_player_id, minute, detail)
   values (@match_id, @team_id, @scorer_player_id, @assist_player_id, @minute, @detail)`,
);

// ── helpers ──────────────────────────────────────────────────────────────────
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
const winnerIdOf = (f: FixtureEntry): number | null =>
  f.teams.home.winner === true ? f.teams.home.id : f.teams.away.winner === true ? f.teams.away.id : null;

const seededIds = (column: string, table: string): Set<number> => {
  const rows = db.prepare(`select distinct ${column} as v from ${table}`).all() as { v: number }[];
  return new Set(rows.map((r) => r.v));
};

// ── steps ──────────────────────────────────────────────────────────────────
async function seedTeams(): Promise<Map<number, string>> {
  const existing = db.prepare("select id, group_letter from teams").all() as { id: number; group_letter: string | null }[];
  if (existing.length > 0) {
    log(`✓ teams: ${existing.length} (already seeded — skipping API)`);
    return new Map(existing.filter((r) => r.group_letter).map((r) => [r.id, r.group_letter as string]));
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
  const insertAll = db.transaction((entries: TeamEntry[]) => {
    for (const e of entries) {
      upsertTeam.run({ id: e.team.id, name: e.team.name, code: e.team.code, group_letter: teamToGroup.get(e.team.id) ?? null });
    }
  });
  insertAll(teamEntries);
  log(`✓ teams: ${teamEntries.length}`);
  return teamToGroup;
}

async function seedPlayers(teamIds: number[]): Promise<void> {
  const done = seededIds("team_id", "players");
  const todo = teamIds.filter((id) => !done.has(id));
  if (todo.length === 0) {
    log(`✓ players: ${done.size} squads (already seeded — skipping API)`);
    return;
  }
  for (const teamId of todo) {
    const squads = await apiGet<SquadEntry>("players/squads", { team: teamId });
    const players = squads[0]?.players ?? [];
    const insertAll = db.transaction(() => {
      for (const p of players) {
        upsertPlayer.run({ id: p.id, team_id: teamId, name: p.name, position: p.position, shirt_number: p.number });
      }
    });
    insertAll();
  }
  log(`✓ players: +${todo.length} squads`);
}

// `players/squads` returns the CURRENT squad, so 2022 scorers who have since left
// their national team (e.g. Giroud) are missing — ~35% of goal events referenced
// a player_id not in `players`. This self-healing step backfills exactly those
// gaps by player id (season 2022). Team is derived locally from the match, not
// the API: a normal/penalty goal credits the scorer's team, an own goal credits
// the opponent — so an own-goal scorer belongs to the match's OTHER team.
function orphanGoalPlayers(): OrphanPlayer[] {
  return db
    .prepare(
      `select pid, team_id from (
         select g.scorer_player_id as pid,
           case when g.detail = 'owngoal'
             then case when g.team_id = m.home_team_id then m.away_team_id else m.home_team_id end
             else g.team_id end as team_id
         from goals g join matches m on g.match_id = m.id
         where g.scorer_player_id is not null
         union
         select g.assist_player_id as pid, g.team_id as team_id
         from goals g where g.assist_player_id is not null
       )
       where pid not in (select id from players)
       group by pid`,
    )
    .all() as OrphanPlayer[];
}

async function backfillGoalPlayers(): Promise<void> {
  const orphans = orphanGoalPlayers();
  if (orphans.length === 0) {
    log("✓ goal players: all resolved (no backfill)");
    return;
  }
  let filled = 0;
  for (const orphan of orphans) {
    const entries = await apiGet<PlayerByIdEntry>("players", { id: orphan.pid, season: WC_SEASON });
    const player = entries[0]?.player;
    if (!player) {
      log(`  ⚠ player ${orphan.pid}: no 2022 record — left unresolved`);
      continue;
    }
    const position = entries[0]?.statistics?.[0]?.games?.position ?? null;
    upsertPlayer.run({ id: player.id, team_id: orphan.team_id, name: player.name, position, shirt_number: null });
    filled += 1;
  }
  log(`✓ goal players backfilled: +${filled}/${orphans.length}`);
}

async function seedMatches(teamToGroup: Map<number, string>): Promise<FixtureEntry[]> {
  const fixtures = await apiGet<FixtureEntry>("fixtures", { league: WC_LEAGUE_ID, season: WC_SEASON });
  const insertAll = db.transaction(() => {
    for (const f of fixtures) {
      const round = ROUND_MAP[f.league.round] ?? f.league.round;
      const etHome = f.score.extratime.home;
      const etAway = f.score.extratime.away;
      const hasEt = etHome !== null && etAway !== null;
      upsertMatch.run({
        id: f.fixture.id,
        round,
        group_letter: round === "group" ? (teamToGroup.get(f.teams.home.id) ?? null) : null,
        home_team_id: f.teams.home.id,
        away_team_id: f.teams.away.id,
        ht_home: f.score.halftime.home, ht_away: f.score.halftime.away,
        ft_home: f.score.fulltime.home, ft_away: f.score.fulltime.away,
        // et = cumulative post-ET score = fulltime + extratime delta (2-2 + 1-1 → 3-3)
        et_home: hasEt ? (f.score.fulltime.home ?? 0) + (etHome ?? 0) : null,
        et_away: hasEt ? (f.score.fulltime.away ?? 0) + (etAway ?? 0) : null,
        pen_home: f.score.penalty.home, pen_away: f.score.penalty.away,
        winner_team_id: winnerIdOf(f),
        venue: f.fixture.venue.name, city: f.fixture.venue.city, referee: f.fixture.referee,
        kickoff_at: f.fixture.date,
      });
    }
  });
  insertAll();
  log(`✓ matches: ${fixtures.length}`);
  return fixtures;
}

// Point each match in one round at the next-round match its winner advanced to.
function linkRound(matches: FixtureEntry[], nextMatches: FixtureEntry[]): void {
  for (const f of matches) {
    const winnerId = winnerIdOf(f);
    if (winnerId === null) continue;
    const target = nextMatches.find((m) => m.teams.home.id === winnerId || m.teams.away.id === winnerId);
    if (target) setNextMatch.run({ id: f.fixture.id, next: target.fixture.id });
  }
}

// Bracket edges: each knockout winner feeds exactly one next-round match.
function linkBracket(fixtures: FixtureEntry[]): void {
  const byRound = new Map<string, FixtureEntry[]>();
  for (const f of fixtures) {
    const round = ROUND_MAP[f.league.round] ?? f.league.round;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round)!.push(f);
  }
  const linkAll = db.transaction(() => {
    for (const [round, nextRound] of Object.entries(NEXT_ROUND)) {
      linkRound(byRound.get(round) ?? [], byRound.get(nextRound) ?? []);
    }
  });
  linkAll();
  log("✓ bracket edges linked");
}

function statParams(matchId: number, s: StatEntry) {
  const get = (type: string) => s.statistics.find((x) => x.type === type)?.value ?? null;
  return {
    match_id: matchId, team_id: s.team.id,
    possession: parsePercent(get("Ball Possession")),
    shots_total: parseInt0(get("Total Shots")), shots_on: parseInt0(get("Shots on Goal")),
    shots_off: parseInt0(get("Shots off Goal")), shots_blocked: parseInt0(get("Blocked Shots")),
    corners: parseInt0(get("Corner Kicks")), fouls: parseInt0(get("Fouls")), offsides: parseInt0(get("Offsides")),
    yellow_cards: parseInt0(get("Yellow Cards")), red_cards: parseInt0(get("Red Cards")),
    gk_saves: parseInt0(get("Goalkeeper Saves")), passes_total: parseInt0(get("Total passes")),
    passes_pct: parsePercent(get("Passes %")),
  };
}

function goalParams(matchId: number, e: GoalEvent) {
  // API-Football already credits an own goal to the beneficiary team (event.team) —
  // verified vs 2022 CAN–MAR (Aguerd OG credited to Canada). So no team flip.
  const detail = e.detail === "Own Goal" ? "owngoal" : e.detail === "Penalty" ? "penalty" : "normal";
  return {
    match_id: matchId, team_id: e.team.id,
    scorer_player_id: e.player.id, assist_player_id: e.assist.id,
    minute: (e.time.elapsed ?? 0) + (e.time.extra ?? 0), // include added time
    detail,
  };
}

async function upsertStats(matchId: number): Promise<void> {
  const stats = await apiGet<StatEntry>("fixtures/statistics", { fixture: matchId });
  const run = db.transaction(() => stats.forEach((s) => upsertStat.run(statParams(matchId, s))));
  run();
}

async function upsertGoals(matchId: number): Promise<void> {
  const events = await apiGet<GoalEvent>("fixtures/events", { fixture: matchId });
  const isMatchGoal = (e: GoalEvent) => e.type === "Goal" && COUNTABLE_GOAL_DETAILS.has(e.detail) && e.comments !== SHOOTOUT_COMMENT;
  const rows = events.filter(isMatchGoal);
  const run = db.transaction(() => {
    deleteGoals.run({ match_id: matchId }); // idempotent: clear then insert
    rows.forEach((e) => insertGoal.run(goalParams(matchId, e)));
  });
  run();
}

async function seedStatsAndGoals(fixtures: FixtureEntry[]): Promise<void> {
  const statsDone = seededIds("match_id", "match_stats");
  const goalsDone = seededIds("match_id", "goals");
  for (const f of fixtures) {
    if (!statsDone.has(f.fixture.id)) await upsertStats(f.fixture.id);
    if (!goalsDone.has(f.fixture.id)) await upsertGoals(f.fixture.id);
  }
  log("✓ match_stats + goals");
}

async function main(): Promise<void> {
  try {
    const teamToGroup = await seedTeams();
    await seedPlayers([...teamToGroup.keys()]);
    const fixtures = await seedMatches(teamToGroup);
    linkBracket(fixtures);
    await seedStatsAndGoals(fixtures);
    await backfillGoalPlayers(); // fill scorers/assisters missing from current squads
    log("✅ seed complete");
  } catch (err) {
    if (err instanceof RateLimitError) {
      log(`⏸ daily quota hit — progress saved to ${DB_PATH}, re-run tomorrow to resume.`);
      process.exit(0);
    }
    throw err;
  } finally {
    db.close();
  }
}

void main();
