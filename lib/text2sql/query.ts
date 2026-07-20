// Safety layer entry point (PRD §4.1): validate → execute, collapsing every
// failure into a typed outcome so the Server Action (§5) never 500s. Order
// matters — AST validation gates execution, and the read-only connection
// backs it up.

import { executeReadOnly } from "./execute";
import { validateReadOnlySelect } from "./validate";

export type QueryOutcome =
  | { status: "ok"; columns: string[]; rows: unknown[][]; truncated: boolean }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

export function safeQuery(sql: string): QueryOutcome {
  const validation = validateReadOnlySelect(sql);
  if (!validation.valid) return { status: "invalid", message: validation.reason ?? "Invalid query." };

  try {
    const result = executeReadOnly(sql);
    return { status: "ok", ...result };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `Query execution failed: ${detail}` };
  }
}
