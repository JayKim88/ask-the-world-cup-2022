import { describe, expect, it } from "vitest";

import { chooseChart, detectRoles } from "./chart";

describe("detectRoles", () => {
  it("finds the category column and numeric columns", () => {
    const roles = detectRoles(["team", "goals", "shots"], [["Spain", 7, 40]]);
    expect(roles).toEqual({ categoryIndex: 0, numericIndices: [1, 2] });
  });

  it("treats a column with nulls but only numbers as numeric", () => {
    const roles = detectRoles(["team", "pen"], [["ARG", 4], ["FRA", null]]);
    expect(roles.numericIndices).toContain(1);
  });
});

describe("chooseChart", () => {
  it("routes an empty result to table", () => {
    expect(chooseChart(["x"], [], "bar")).toBe("table");
  });

  it("routes a 1x1 result to scalar regardless of hint", () => {
    expect(chooseChart(["total"], [[64]])).toBe("scalar");
  });

  it("honors a bar hint when shape is category + numeric", () => {
    expect(chooseChart(["team", "goals"], [["Spain", 7], ["England", 6]], "bar")).toBe("bar");
  });

  it("honors a pie hint only within the slice limit", () => {
    const rows = [["A", 1], ["B", 2], ["C", 3]];
    expect(chooseChart(["group", "pts"], rows, "pie")).toBe("pie");
  });

  it("downgrades an over-sliced pie to an auto bar (still a clean aggregate)", () => {
    const rows = Array.from({ length: 12 }, (_, index) => [`t${index}`, index]);
    expect(chooseChart(["team", "goals"], rows, "pie")).toBe("bar");
  });

  it("falls back to table when the hint does not fit the shape", () => {
    // bar needs a category column; two numeric columns can't be a bar.
    expect(chooseChart(["a", "b"], [[1, 2], [3, 4]], "bar")).toBe("table");
  });

  it("auto-bars a clean label+number aggregate with no hint", () => {
    expect(chooseChart(["team", "goals"], [["Spain", 7], ["England", 6]])).toBe("bar");
  });

  it("does NOT auto-bar a detail shape (multiple numeric columns)", () => {
    expect(chooseChart(["team", "goals", "shots"], [["Spain", 7, 40]])).toBe("table");
  });

  it("does NOT auto-bar when the label is not the first column", () => {
    expect(chooseChart(["match_id", "team"], [[1, "Spain"], [2, "France"]])).toBe("table");
  });

  it("rejects a chart even with a hint when rows exceed the chart cap", () => {
    const rows = Array.from({ length: 50 }, (_, index) => [`t${index}`, index]);
    expect(chooseChart(["team", "goals"], rows, "bar")).toBe("table");
  });
});
