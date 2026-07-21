// Execution wrapper (PRD §4.1). The real defense: the bundled snapshot is
// opened READ-ONLY (writes are physically impossible), so even a SQL that
// slips past the AST validator cannot mutate data. Results stream through
// iterate() capped at MAX_RESULT_ROWS — this bounds both result size and a
// runaway/infinite recursive CTE (SQLite produces rows lazily; we stop
// consuming). better-sqlite3 is synchronous and exposes no interrupt(), so a
// CPU-bound timeout is left to the platform function limit (Vercel) — the row
// cap is what makes that a non-issue on this tiny fixed dataset.
//
// The DB is a FIXED read-only file (unlike per-user BYOK keys), so a single
// cached connection is correct and cheaper than opening one per query.

import path from "node:path";

import Database from "better-sqlite3";

import { MAX_RESULT_ROWS } from "./constants";

export { MAX_RESULT_ROWS };

const DB_PATH = process.env.SQLITE_DB_PATH ?? path.join(process.cwd(), "db", "worldcup.db");

// Rows are positional arrays aligned with `columns`, not objects: SQL can
// return duplicate column names (e.g. `SELECT home.name, away.name …`, common
// in this domain's home/away joins) which an object would silently collapse.
export interface ExecuteResult {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}

let cachedDb: Database.Database | null = null;

function bundledDb(): Database.Database {
  if (!cachedDb) cachedDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return cachedDb;
}

// Takes an injected connection so tests can run against an in-memory fixture DB.
export function runQuery(db: Database.Database, sql: string): ExecuteResult {
  const stmt = db.prepare(sql);
  const columns = stmt.columns().map((column) => column.name);

  const rows: unknown[][] = [];
  let truncated = false;
  for (const row of stmt.raw().iterate()) {
    const isAtCap = rows.length >= MAX_RESULT_ROWS;
    if (isAtCap) {
      truncated = true; // a further row exists beyond the cap
      break;
    }
    rows.push(row as unknown[]);
  }

  return { columns, rows, truncated };
}

export function executeReadOnly(sql: string): ExecuteResult {
  return runQuery(bundledDb(), sql);
}
