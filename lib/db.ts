// Shared read-only connection to the bundled snapshot (PRD §4.1). The DB is a
// FIXED read-only file, so one cached connection is correct and cheaper than
// opening per call — reused by the query executor (§4) and the bracket (§6).

import path from "node:path";

import Database from "better-sqlite3";

const DB_PATH = process.env.SQLITE_DB_PATH ?? path.join(process.cwd(), "db", "worldcup.db");

let cachedDb: Database.Database | null = null;

export function bundledDb(): Database.Database {
  if (!cachedDb) cachedDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return cachedDb;
}
