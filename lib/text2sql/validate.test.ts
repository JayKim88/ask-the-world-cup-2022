import { describe, expect, it } from "vitest";

import { validateReadOnlySelect } from "./validate";

describe("validateReadOnlySelect", () => {
  it("accepts a simple SELECT", () => {
    expect(validateReadOnlySelect('SELECT * FROM teams WHERE group_letter = "A"').valid).toBe(true);
  });

  it("accepts a window function without PARTITION BY (sqlite-dialect gap this guards)", () => {
    expect(validateReadOnlySelect("SELECT team_id, RANK() OVER (ORDER BY points DESC) FROM standings").valid).toBe(true);
  });

  it("accepts the flagship recursive CTE", () => {
    const sql =
      "WITH RECURSIVE path AS (SELECT id, next_match_id FROM matches WHERE id = 1 " +
      "UNION ALL SELECT m.id, m.next_match_id FROM matches m JOIN path p ON m.id = p.next_match_id) " +
      "SELECT * FROM path";
    expect(validateReadOnlySelect(sql).valid).toBe(true);
  });

  it("rejects INSERT", () => {
    expect(validateReadOnlySelect("INSERT INTO teams VALUES (1)").valid).toBe(false);
  });

  it("rejects DROP", () => {
    expect(validateReadOnlySelect("DROP TABLE teams").valid).toBe(false);
  });

  it("rejects a stacked second statement", () => {
    expect(validateReadOnlySelect("SELECT 1; DROP TABLE teams").valid).toBe(false);
  });

  it("rejects empty input", () => {
    expect(validateReadOnlySelect("   ").valid).toBe(false);
  });

  it("rejects unparseable garbage", () => {
    expect(validateReadOnlySelect("not sql at all").valid).toBe(false);
  });
});
