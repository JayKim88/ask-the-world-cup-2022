-- Ask the World Cup 2022 — schema (PRD §3)
-- 2022 FIFA World Cup snapshot. Run once in the Supabase SQL editor before seeding.
-- IDs mirror API-Football source IDs (team/fixture/player) to preserve relationships.

create table if not exists teams (
  id           bigint primary key,          -- API-Football team id
  name         text not null,
  code         text,                        -- 3-letter (e.g. ARG); may be null
  group_letter char(1)                      -- A..H, from standings endpoint
);

create table if not exists players (
  id           bigint primary key,          -- API-Football player id
  team_id      bigint not null references teams(id),
  name         text not null,
  position     text,                        -- Goalkeeper / Defender / Midfielder / Attacker
  shirt_number int
);

create table if not exists matches (
  id            bigint primary key,         -- API-Football fixture id
  round         text not null,              -- group | ro16 | qf | sf | third_place | final
  group_letter  char(1),                    -- set for group-stage rows only
  home_team_id  bigint not null references teams(id),
  away_team_id  bigint not null references teams(id),
  ht_home       int, ht_away int,           -- halftime
  ft_home       int, ft_away int,           -- regulation 90' (score.fulltime), e.g. 2-2
  et_home       int, et_away int,           -- CUMULATIVE after extra time (ft + ET delta), e.g. 3-3; null if no ET
  pen_home      int, pen_away int,          -- penalty shootout, e.g. 4-2; null if none
  winner_team_id bigint references teams(id),-- from API teams.winner flag; null for draws/group
  -- headline "final score" = coalesce(et_home, ft_home) : coalesce(et_away, ft_away)
  venue         text,
  city          text,
  referee       text,
  kickoff_at    timestamptz,
  next_match_id bigint references matches(id) -- self-ref bracket edge; built at seed time
);

create table if not exists match_stats (
  match_id      bigint not null references matches(id),
  team_id       bigint not null references teams(id),
  possession    int,                        -- percent (0..100)
  shots_total   int, shots_on int, shots_off int, shots_blocked int,
  corners       int, fouls int, offsides int,
  yellow_cards  int, red_cards int,
  gk_saves      int, passes_total int, passes_pct int,
  primary key (match_id, team_id)
);

-- Goals carry player ids directly (API-Football events) — no name matching needed.
-- scorer/assist ids are logical refs (not FK-constrained) to keep seeding robust
-- against any event player missing from the fetched squads.
create table if not exists goals (
  id               bigserial primary key,
  match_id         bigint not null references matches(id),
  team_id          bigint not null references teams(id),
  scorer_player_id bigint,
  assist_player_id bigint,
  minute           int,
  detail           text                     -- normal | penalty | owngoal
);

-- Query-path indexes (the app runs arbitrary read-only SELECTs).
create index if not exists idx_matches_round      on matches(round);
create index if not exists idx_matches_home        on matches(home_team_id);
create index if not exists idx_matches_away        on matches(away_team_id);
create index if not exists idx_matches_next        on matches(next_match_id);
create index if not exists idx_match_stats_team    on match_stats(team_id);
create index if not exists idx_goals_match         on goals(match_id);
create index if not exists idx_goals_scorer        on goals(scorer_player_id);
create index if not exists idx_players_team         on players(team_id);
