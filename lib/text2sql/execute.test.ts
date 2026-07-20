import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MAX_RESULT_ROWS, runQuery } from "./execute";

// In-memory fixture so these tests don't depend on the seeded db/worldcup.db.
let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  db.exec("CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT, group_letter TEXT)");
  db.exec("INSERT INTO teams VALUES (1, 'Argentina', 'C'), (2, 'France', 'D'), (3, 'Croatia', 'F')");
});

afterAll(() => db.close());

describe("runQuery", () => {
  const seededTeamCount = 3;

  it("returns column names and positional rows for a SELECT", () => {
    const result = runQuery(db, "SELECT id, name FROM teams ORDER BY id");
    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rows).toHaveLength(seededTeamCount);
    expect(result.rows[0]).toEqual([1, "Argentina"]);
    expect(result.truncated).toBe(false);
  });

  it("preserves duplicate column names positionally (object would collapse them)", () => {
    const result = runQuery(db, "SELECT h.name, a.name FROM teams h JOIN teams a ON h.id < a.id ORDER BY a.id");
    expect(result.columns).toEqual(["name", "name"]);
    expect(result.rows[0]).toEqual(["Argentina", "France"]);
  });

  it("caps result size and flags truncation on an unbounded recursive CTE (cost-attack defense)", () => {
    // No termination clause — only the row cap stops it. Proves lazy iterate() bounds runaway recursion.
    const result = runQuery(db, "WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c) SELECT n FROM c");
    expect(result.rows).toHaveLength(MAX_RESULT_ROWS);
    expect(result.truncated).toBe(true);
  });

  it("does not flag truncation when the result fits under the cap", () => {
    const boundedDepth = 10;
    const result = runQuery(
      db,
      `WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c WHERE n < ${boundedDepth}) SELECT n FROM c`,
    );
    expect(result.rows).toHaveLength(boundedDepth);
    expect(result.truncated).toBe(false);
  });
});
