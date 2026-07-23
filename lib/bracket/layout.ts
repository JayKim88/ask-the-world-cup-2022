// Bracket layout (PRD §6) — pure geometry, no D3/DOM, so it is unit-testable.
// The tree is derived from next_match_id: each match feeds exactly one successor.
// Leaves (Round of 16) get sequential vertical slots; each successor sits at the
// average height of the matches feeding it, producing the classic bracket shape.
// The third-place match has no successor and is parked below the tree.

import type { BracketMatch, KnockoutRound } from "./query";

const COLUMN_OF: Record<KnockoutRound, number> = { ro16: 0, qf: 1, sf: 2, final: 3, third_place: 2 };
const COLUMN_WIDTH = 210;
const ROW_HEIGHT = 72;
const THIRD_PLACE_GAP = ROW_HEIGHT; // vertical gap below the main tree

export interface PositionedMatch {
  match: BracketMatch;
  column: number;
  x: number;
  y: number;
}

export interface BracketLink {
  source: PositionedMatch;
  target: PositionedMatch;
}

export interface BracketLayout {
  nodes: PositionedMatch[];
  links: BracketLink[];
  width: number;
  height: number;
}

const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

export function layoutBracket(matches: BracketMatch[]): BracketLayout {
  const feeders = new Map<number, BracketMatch[]>();
  for (const match of matches) {
    if (match.nextMatchId === null) continue;
    const list = feeders.get(match.nextMatchId) ?? [];
    list.push(match);
    feeders.set(match.nextMatchId, list);
  }

  const positioned = new Map<number, PositionedMatch>();
  let nextLeafSlot = 0;

  // Post-order: place feeders first so leaves take slots top-to-bottom in tree order.
  function place(match: BracketMatch): PositionedMatch {
    const existing = positioned.get(match.id);
    if (existing) return existing;

    const preds = feeders.get(match.id) ?? [];
    const isLeaf = preds.length === 0;
    let y: number;
    if (isLeaf) {
      y = nextLeafSlot * ROW_HEIGHT;
      nextLeafSlot += 1;
    } else {
      y = average(preds.map((pred) => place(pred).y));
    }

    const column = COLUMN_OF[match.round];
    const node: PositionedMatch = { match, column, x: column * COLUMN_WIDTH, y };
    positioned.set(match.id, node);
    return node;
  }

  const finalMatch = matches.find((match) => match.round === "final");
  if (finalMatch) place(finalMatch);

  // Park the third-place match (no successor) below the deepest leaf.
  const thirdPlace = matches.find((match) => match.round === "third_place");
  if (thirdPlace && !positioned.has(thirdPlace.id)) {
    const column = COLUMN_OF[thirdPlace.round];
    positioned.set(thirdPlace.id, {
      match: thirdPlace,
      column,
      x: column * COLUMN_WIDTH,
      y: nextLeafSlot * ROW_HEIGHT + THIRD_PLACE_GAP,
    });
  }

  const nodes = [...positioned.values()];
  const links: BracketLink[] = [];
  for (const node of nodes) {
    const nextId = node.match.nextMatchId;
    if (nextId === null) continue;
    const target = positioned.get(nextId);
    if (target) links.push({ source: node, target });
  }

  const maxY = Math.max(...nodes.map((node) => node.y));
  return { nodes, links, width: (COLUMN_OF.final + 1) * COLUMN_WIDTH, height: maxY + ROW_HEIGHT };
}
