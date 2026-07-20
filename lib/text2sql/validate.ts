// AST validation (PRD §4.1). The LLM's SQL is untrusted: parse it with the
// SQLite dialect and allow ONLY a single SELECT / WITH … SELECT statement.
// Anything else (INSERT/UPDATE/DELETE/DROP/PRAGMA, multiple statements) is
// rejected before it ever reaches the database. This is the FIRST line of
// defense; the real guarantee is the read-only connection in execute.ts.

import { Parser } from "node-sql-parser";
import type { AST } from "node-sql-parser";

// We parse with the PostgreSQL grammar, not SQLite — deliberately. This is a
// statement-type CLASSIFIER (is it one read-only SELECT?), not a SQLite
// linter: node-sql-parser's sqlite dialect fails on a window function without
// PARTITION BY (e.g. `RANK() OVER (ORDER BY pts DESC)`), a common ranking
// query, while the postgres grammar parses it and still classifies
// INSERT/UPDATE/DELETE/DROP/multi-statement correctly. Actual SQLite-syntax
// correctness is enforced at execution; the read-only connection is the real
// guarantee.
const PARSER_OPTIONS = { database: "postgresql" } as const;
const SELECT_TYPE = "select";

const parser = new Parser();

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateReadOnlySelect(sql: string): ValidationResult {
  const trimmed = sql.trim();
  if (!trimmed) return { valid: false, reason: "Empty query." };

  let ast: AST | AST[];
  try {
    ast = parser.astify(trimmed, PARSER_OPTIONS);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Unparseable SQL: ${detail}` };
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  const isSingleStatement = statements.length === 1;
  if (!isSingleStatement) return { valid: false, reason: "Only a single statement is allowed." };

  // A WITH … SELECT (incl. WITH RECURSIVE, our bracket query) parses as type "select".
  const isSelect = statements[0].type === SELECT_TYPE;
  if (!isSelect) return { valid: false, reason: "Only read-only SELECT queries are allowed." };

  return { valid: true };
}
