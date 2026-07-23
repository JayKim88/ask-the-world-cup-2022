// Bracket data (PRD §6). Reads the knockout matches from the bundled snapshot
// and shapes them for the D3 tree — the bracket structure comes from the
// self-referencing next_match_id, the signature use of the recursive schema.

import { bundledDb } from "@/lib/db";

export type KnockoutRound = "ro16" | "qf" | "sf" | "third_place" | "final";

export interface BracketMatch {
  id: number;
  round: KnockoutRound;
  homeTeam: string;
  awayTeam: string;
  score: string;
  winner: string | null;
  nextMatchId: number | null;
  venue: string | null;
  city: string | null;
}

interface KnockoutRow {
  id: number;
  round: KnockoutRound;
  home: string;
  away: string;
  ft_home: number | null;
  ft_away: number | null;
  et_home: number | null;
  et_away: number | null;
  pen_home: number | null;
  pen_away: number | null;
  winner: string | null;
  next_match_id: number | null;
  venue: string | null;
  city: string | null;
}

const KNOCKOUT_SQL = `
  SELECT m.id, m.round, h.name AS home, a.name AS away,
    m.ft_home, m.ft_away, m.et_home, m.et_away, m.pen_home, m.pen_away,
    w.name AS winner, m.next_match_id, m.venue, m.city
  FROM matches m
  JOIN teams h ON m.home_team_id = h.id
  JOIN teams a ON m.away_team_id = a.id
  LEFT JOIN teams w ON m.winner_team_id = w.id
  WHERE m.round IN ('ro16', 'qf', 'sf', 'third_place', 'final')`;

function formatScore(row: KnockoutRow): string {
  const wentToPenalties = row.pen_home !== null && row.pen_away !== null;
  const wentToExtraTime = row.et_home !== null && row.et_away !== null;
  if (wentToPenalties) return `${row.et_home}-${row.et_away} (승부차기 ${row.pen_home}-${row.pen_away})`;
  if (wentToExtraTime) return `${row.et_home}-${row.et_away} (연장)`;
  return `${row.ft_home}-${row.ft_away}`;
}

function toBracketMatch(row: KnockoutRow): BracketMatch {
  return {
    id: row.id,
    round: row.round,
    homeTeam: row.home,
    awayTeam: row.away,
    score: formatScore(row),
    winner: row.winner,
    nextMatchId: row.next_match_id,
    venue: row.venue,
    city: row.city,
  };
}

export function getBracket(): BracketMatch[] {
  const rows = bundledDb().prepare(KNOCKOUT_SQL).all() as KnockoutRow[];
  return rows.map(toBracketMatch);
}
