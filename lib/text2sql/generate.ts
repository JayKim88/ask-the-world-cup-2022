// NL → SQL generation (PRD §3). generateObject forces a Zod-validated shape;
// the LLM itself signals sql / clarify / reject via `kind`. answer() never
// throws — LLM/network failures collapse to status "error" (never-500 wrapper),
// so the Server Action can always return a clean result.
//
// The schema is a single flat object (not a discriminated union / anyOf): union
// schemas aren't reliably supported by every provider's structured output —
// notably Gemini, the default — so a flat object is the portable choice.

import { generateText, Output } from "ai";
import { z } from "zod";

import { buildModel, supportsTemperature } from "./model";
import { SCHEMA_CONTEXT } from "./schema-context";

// Bracket routing is app-owned (PRD §6.1), not an LLM hint — so it's not here.
const VIZ_HINTS = ["table", "bar", "line", "pie", "scalar"] as const;

const resultSchema = z.object({
  kind: z.enum(["sql", "clarify", "reject"]).describe("sql = answerable query; clarify = ambiguous; reject = out of scope."),
  sql: z.string().optional().describe("When kind=sql: a single read-only SQLite SELECT / WITH … SELECT query, no trailing semicolon."),
  explanation: z.string().optional().describe("When kind=sql: one or two sentences, in the user's language, describing the query."),
  viz_hint: z.enum(VIZ_HINTS).optional().describe("Optional visualization suggestion; the app validates it against the real result shape."),
  message: z.string().optional().describe("When kind=clarify/reject: a short clarifying question or polite refusal."),
});

type ResultObject = z.infer<typeof resultSchema>;

const SYSTEM_PROMPT = `${SCHEMA_CONTEXT}

Set kind="sql" (with sql + explanation) when the question maps to the schema.
Set kind="clarify" (with message) when the request is ambiguous (e.g. references a team/player without naming it).
Set kind="reject" (with message) when it asks for data not in the schema, a subjective judgement, or a prediction.
Never invent columns or tables. Never write or modify data.`;

export type Text2SqlStatus = "planned" | "clarify" | "rejected" | "error";

export interface Text2SqlResponse {
  status: Text2SqlStatus;
  sql?: string;
  explanation?: string;
  vizHint?: string;
  message?: string;
}

export interface GenerateArgs {
  question: string;
  model: string;
  apiKey: string;
}

// Pure mapping from the model's structured object to our response shape.
export function mapResult(object: ResultObject): Text2SqlResponse {
  if (object.kind === "sql") {
    if (!object.sql) return { status: "error", message: "Model returned kind=sql without a query." };
    return { status: "planned", sql: object.sql, explanation: object.explanation ?? "", vizHint: object.viz_hint };
  }
  if (object.kind === "clarify") return { status: "clarify", message: object.message ?? "" };
  return { status: "rejected", message: object.message ?? "" };
}

export async function answer({ question, model, apiKey }: GenerateArgs): Promise<Text2SqlResponse> {
  try {
    // v7: generateObject is deprecated → generateText with an Output spec.
    const { output } = await generateText({
      model: buildModel(model, apiKey),
      output: Output.object({ schema: resultSchema }),
      system: SYSTEM_PROMPT,
      prompt: question,
      temperature: supportsTemperature(model) ? 0 : undefined, // deterministic SQL + eval reproducibility (PRD §5)
    });
    return mapResult(output);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { status: "error", message: `SQL generation failed: ${detail}` };
  }
}
