import { describe, expect, it } from "vitest";

import { compareResults, type QueryResult } from "./compare";

const result = (rows: unknown[][]): QueryResult => ({ columns: ["a", "b"], rows });

describe("compareResults", () => {
  it("matches identical results", () => {
    expect(compareResults(result([["Spain", 7]]), result([["Spain", 7]]), true).match).toBe(true);
  });

  it("fails on a different row count", () => {
    expect(compareResults(result([["Spain", 7]]), result([]), false).match).toBe(false);
  });

  it("order-sensitive: same rows in a different order do NOT match", () => {
    const gold = result([["Mbappe", 8], ["Messi", 7]]);
    const actual = result([["Messi", 7], ["Mbappe", 8]]);
    expect(compareResults(gold, actual, true).match).toBe(false);
  });

  it("order-insensitive: same rows in a different order match", () => {
    const gold = result([["Spain", 9], ["England", 6]]);
    const actual = result([["England", 6], ["Spain", 9]]);
    expect(compareResults(gold, actual, false).match).toBe(true);
  });

  it("distinguishes numeric values", () => {
    expect(compareResults(result([["x", 7]]), result([["x", 8]]), false).match).toBe(false);
  });

  it("treats null distinctly from a value", () => {
    expect(compareResults(result([["x", null]]), result([["x", 0]]), false).match).toBe(false);
  });
});
