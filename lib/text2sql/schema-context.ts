// Schema description injected into the NL→SQL prompt (PRD §3). Kept in sync with
// db/schema.sql by hand — this is the LLM-facing view, phrased for grounding.

export const SCHEMA_CONTEXT = `You write SQLite queries over a read-only snapshot of the 2022 FIFA World Cup.
Dialect: SQLite (window functions and recursive CTEs are supported). Read-only: only SELECT / WITH.

Tables:

teams(id, name, code, group_letter)
  - group_letter: 'A'..'H'.

players(id, team_id, name, position, shirt_number)
  - team_id → teams.id. position: Goalkeeper | Defender | Midfielder | Attacker.

matches(id, round, group_letter, home_team_id, away_team_id,
        ht_home, ht_away, ft_home, ft_away, et_home, et_away, pen_home, pen_away,
        winner_team_id, venue, city, referee, kickoff_at, next_match_id)
  - round: 'group' | 'ro16' | 'qf' | 'sf' | 'third_place' | 'final'.
  - group_letter is set only for group-stage rows.
  - ht = halftime, ft = regulation 90'. et = CUMULATIVE score after extra time (e.g. 3-3), null if no ET.
    pen = penalty shootout, null if none.
  - FINAL SCORE of a match = coalesce(et_home, ft_home) : coalesce(et_away, ft_away).
  - winner_team_id is set for knockout matches (null for group-stage draws).
  - next_match_id → matches.id: the next-round match this match's WINNER advanced to.
    Use a recursive CTE over next_match_id to trace a team's knockout path.
  - home_team_id / away_team_id / winner_team_id → teams.id.

match_stats(match_id, team_id, possession, shots_total, shots_on, shots_off, shots_blocked,
            corners, fouls, offsides, yellow_cards, red_cards, gk_saves, passes_total, passes_pct)
  - one row per (match, team). possession & passes_pct are integer percents.

goals(id, match_id, team_id, scorer_player_id, assist_player_id, minute, detail)
  - team_id = the team CREDITED with the goal. scorer_player_id / assist_player_id → players.id
    (assist may be null). detail: 'normal' | 'penalty' | 'owngoal'.

Notes:
  - Group standings are NOT stored — compute them from matches (win = 3 pts, draw = 1)
    with GROUP BY + window functions (RANK OVER PARTITION BY group_letter).
  - "top scorer" = count goals by scorer_player_id (exclude own goals if asked about a player's tally).
  - Always produce ONE statement. Never write / modify data.`;
