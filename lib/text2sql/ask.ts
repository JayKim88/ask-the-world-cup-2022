// Orchestrator (PRD §5): NL → SQL (§3 answer) → validate + execute (§4 safeQuery),
// collapsed into one discriminated result the UI renders directly. Both stages
// already never throw, so ask() never throws either.

import { answer } from "./generate";
import { safeQuery } from "./query";

export type AskResult =
  | { kind: "result"; sql: string; explanation: string; vizHint?: string; columns: string[]; rows: unknown[][]; truncated: boolean }
  | { kind: "clarify"; message: string }
  | { kind: "rejected"; message: string }
  | { kind: "error"; message: string; sql?: string };

export interface AskArgs {
  question: string;
  model: string;
  apiKey: string;
}

export async function ask({ question, model, apiKey }: AskArgs): Promise<AskResult> {
  const generated = await answer({ question, model, apiKey });

  if (generated.status === "clarify") return { kind: "clarify", message: generated.message ?? "" };
  if (generated.status === "rejected") return { kind: "rejected", message: generated.message ?? "" };
  if (generated.status === "error") return { kind: "error", message: generated.message ?? "SQL generation failed." };

  // status === "planned": a SQL query was produced — validate and execute it.
  const sql = generated.sql ?? "";
  const outcome = safeQuery(sql);
  if (outcome.status === "ok") {
    return {
      kind: "result",
      sql,
      explanation: generated.explanation ?? "",
      vizHint: generated.vizHint,
      columns: outcome.columns,
      rows: outcome.rows,
      truncated: outcome.truncated,
    };
  }

  // invalid (failed AST gate) or execution error — surface the SQL so the user sees what ran.
  return { kind: "error", message: outcome.message, sql };
}
