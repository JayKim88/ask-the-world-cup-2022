// Execution-match eval (PRD §7). For each gold question: run it through the real
// NL→SQL pipeline (§3, temperature=0 for reproducibility), execute the generated
// SQL and the gold SQL against the snapshot (§4), and compare the results (§7).
//
// Run:  EVAL_API_KEY=... EVAL_MODEL=claude-sonnet-5 pnpm eval
// (or put EVAL_API_KEY / EVAL_MODEL in .env — the script loads it via --env-file)

import { readFileSync } from "node:fs";

import { compareResults, type QueryResult } from "@/lib/eval/compare";
import { answer } from "@/lib/text2sql/generate";
import { safeQuery } from "@/lib/text2sql/query";

interface GoldItem {
  id: string;
  question: string;
  order_sensitive: boolean;
  gold_sql: string;
}

const GOLD_SET_PATH = "eval/gold-set.json";
const PERCENT = 100;
const model = process.env.EVAL_MODEL ?? process.env.TEXT2SQL_MODEL ?? "";
const apiKey = process.env.EVAL_API_KEY ?? "";

const log = (msg: string): void => void process.stdout.write(`${msg}\n`);

type ResolvedResult = { ok: true; result: QueryResult } | { ok: false; error: string };

function execute(sql: string): ResolvedResult {
  const outcome = safeQuery(sql);
  if (outcome.status === "ok") return { ok: true, result: { columns: outcome.columns, rows: outcome.rows } };
  return { ok: false, error: outcome.message };
}

async function scoreItem(item: GoldItem): Promise<boolean> {
  const generated = await answer({ question: item.question, model, apiKey });
  if (generated.status !== "planned" || !generated.sql) {
    log(`✗ ${item.id}: model returned "${generated.status}" (${generated.message ?? ""})`);
    return false;
  }

  const gold = execute(item.gold_sql);
  if (!gold.ok) {
    log(`⚠ ${item.id}: gold SQL failed — ${gold.error}`); // gold set bug, not a model miss
    return false;
  }

  const actual = execute(generated.sql);
  if (!actual.ok) {
    log(`✗ ${item.id}: generated SQL failed — ${actual.error}`);
    return false;
  }

  const comparison = compareResults(gold.result, actual.result, item.order_sensitive);
  log(comparison.match ? `✓ ${item.id}` : `✗ ${item.id}: ${comparison.reason}`);
  return comparison.match;
}

async function main(): Promise<void> {
  if (!apiKey || !model) {
    log("Set EVAL_API_KEY and EVAL_MODEL (or TEXT2SQL_MODEL) — see .env.example.");
    process.exit(1);
  }

  const goldSet = JSON.parse(readFileSync(GOLD_SET_PATH, "utf8")) as GoldItem[];
  let passed = 0;
  for (const item of goldSet) {
    if (await scoreItem(item)) passed += 1;
  }

  const accuracy = ((passed / goldSet.length) * PERCENT).toFixed(1);
  log(`\nexecution-match: ${passed}/${goldSet.length} (${accuracy}%) · model=${model}`);
}

void main();
