// Execution-match comparison (PRD §7). Two queries are "the same answer" when
// they produce the same rows. order_sensitive results (TOP N, rankings) must
// match row-for-row; the rest are compared as multisets. Pure — no I/O — so the
// scoring itself is deterministic and unit-tested.

const CELL_SEPARATOR = "";
const NULL_TOKEN = "∅";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface CompareOutcome {
  match: boolean;
  reason?: string;
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return NULL_TOKEN;
  if (typeof value === "number") return String(value);
  return String(value);
}

// Rows are compared positionally by value (column names are ignored, column
// order is not) — the standard denotation check for text-to-SQL.
function normalizeRow(row: unknown[]): string {
  return row.map(normalizeCell).join(CELL_SEPARATOR);
}

export function compareResults(gold: QueryResult, actual: QueryResult, orderSensitive: boolean): CompareOutcome {
  const sameRowCount = gold.rows.length === actual.rows.length;
  if (!sameRowCount) return { match: false, reason: `rows ${actual.rows.length} ≠ gold ${gold.rows.length}` };

  const goldRows = gold.rows.map(normalizeRow);
  const actualRows = actual.rows.map(normalizeRow);

  if (orderSensitive) {
    const firstDiff = goldRows.findIndex((row, index) => row !== actualRows[index]);
    if (firstDiff !== -1) return { match: false, reason: `row ${firstDiff} differs (order-sensitive)` };
    return { match: true };
  }

  const goldSorted = [...goldRows].sort();
  const actualSorted = [...actualRows].sort();
  const firstDiff = goldSorted.findIndex((row, index) => row !== actualSorted[index]);
  if (firstDiff !== -1) return { match: false, reason: "row sets differ" };
  return { match: true };
}
