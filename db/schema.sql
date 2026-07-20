-- Ask the World Cup 2022 — SQLite schema (PRD §3).
-- Applied by the seeder (scripts/seed.ts). The DB is a fixed read-only snapshot:
-- the app opens db/worldcup.db read-only, so integrity needs no roles/RLS.

create table if not exists teams (
  id           integer primary key,          -- API-Football team id
  name         text not null,
  code         text,                          -- 3-letter (e.g. ARG); may be null
  group_letter text                           -- A..H, from standings endpoint
);

create table if not exists players (
  id           integer primary key,           -- API-Football player id
  team_id      integer not null references teams(id),
  name         text not null,
  position     text,                           -- Goalkeeper / Defender / Midfielder / Attacker
  shirt_number integer
);

create table if not exists matches (
  id             integer primary key,          -- API-Football fixture id
  round          text not null,                -- group | ro16 | qf | sf | third_place | final
  group_letter   text,                          -- set for group-stage rows only
  home_team_id   integer not null references teams(id),
  away_team_id   integer not null references teams(id),
  ht_home        integer, ht_away integer,      -- halftime
  ft_home        integer, ft_away integer,      -- regulation 90' (2-2)
  et_home        integer, et_away integer,      -- CUMULATIVE after ET (ft + delta), e.g. 3-3; null if no ET
  pen_home       integer, pen_away integer,     -- penalty shootout (4-2); null if none
  winner_team_id integer references teams(id),  -- from API winner flag; null for draws/group
  venue          text,
  city           text,
  referee        text,
  kickoff_at     text,                          -- ISO 8601
  next_match_id  integer references matches(id) -- self-ref bracket edge; built at seed time
  -- headline "final score" = coalesce(et_home, ft_home) : coalesce(et_away, ft_away)
);

create table if not exists match_stats (
  match_id      integer not null references matches(id),
  team_id       integer not null references teams(id),
  possession    integer,                        -- percent (0..100)
  shots_total   integer, shots_on integer, shots_off integer, shots_blocked integer,
  corners       integer, fouls integer, offsides integer,
  yellow_cards  integer, red_cards integer,
  gk_saves      integer, passes_total integer, passes_pct integer,
  primary key (match_id, team_id)
);

-- Goals carry player ids directly (API-Football events) — no name matching.
-- scorer/assist ids are logical refs (not FK-constrained) to stay robust.
create table if not exists goals (
  id               integer primary key autoincrement,
  match_id         integer not null references matches(id),
  team_id          integer not null references teams(id),
  scorer_player_id integer,
  assist_player_id integer,
  minute           integer,
  detail           text                         -- normal | penalty | owngoal
);

create index if not exists idx_matches_round   on matches(round);
create index if not exists idx_matches_home     on matches(home_team_id);
create index if not exists idx_matches_away     on matches(away_team_id);
create index if not exists idx_matches_next     on matches(next_match_id);
create index if not exists idx_match_stats_team on match_stats(team_id);
create index if not exists idx_goals_match      on goals(match_id);
create index if not exists idx_goals_scorer     on goals(scorer_player_id);
create index if not exists idx_players_team      on players(team_id);
