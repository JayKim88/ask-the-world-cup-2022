import { describe, expect, it } from "vitest";

import { layoutBracket } from "./layout";
import type { BracketMatch, KnockoutRound } from "./query";

function match(id: number, round: KnockoutRound, nextMatchId: number | null): BracketMatch {
  return { id, round, homeTeam: "H", awayTeam: "A", score: "1-0", winner: "H", nextMatchId, venue: null, city: null };
}

// 4 leaves → 2 mid → final, plus a parked third-place match.
const fixture: BracketMatch[] = [
  match(1, "ro16", 10),
  match(2, "ro16", 10),
  match(3, "ro16", 11),
  match(4, "ro16", 11),
  match(10, "qf", 20),
  match(11, "qf", 20),
  match(20, "final", null),
  match(99, "third_place", null),
];

describe("layoutBracket", () => {
  const layout = layoutBracket(fixture);
  const byId = new Map(layout.nodes.map((node) => [node.match.id, node]));
  const y = (id: number) => byId.get(id)!.y;

  it("positions every match", () => {
    expect(layout.nodes).toHaveLength(fixture.length);
  });

  it("gives leaves distinct, ordered vertical slots", () => {
    expect(y(1)).toBeLessThan(y(2));
    expect(y(2)).toBeLessThan(y(3));
    expect(y(3)).toBeLessThan(y(4));
  });

  it("centers a successor at the average of its feeders", () => {
    expect(y(10)).toBe((y(1) + y(2)) / 2);
    expect(y(20)).toBe((y(10) + y(11)) / 2);
  });

  it("assigns columns by round", () => {
    expect(byId.get(1)!.column).toBe(0);
    expect(byId.get(10)!.column).toBe(1);
    expect(byId.get(20)!.column).toBe(3);
  });

  it("links each match to its successor", () => {
    expect(layout.links).toHaveLength(6); // 4 leaves + 2 mid feed forward
  });

  it("parks the third-place match below the tree", () => {
    const maxTreeY = Math.max(y(1), y(2), y(3), y(4), y(20));
    expect(y(99)).toBeGreaterThan(maxTreeY);
  });
});
