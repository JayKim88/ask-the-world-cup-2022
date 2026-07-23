"use client";

// Top-level client orchestrator (PRD §5). Single owner of { result, isPending };
// BYOK state comes from useApiKey. On submit it calls the Server Action with the
// user's per-request key and stores the discriminated result for rendering.

import { useState, useTransition } from "react";

import Link from "next/link";

import { askAction } from "@/app/actions";
import type { AskResult } from "@/lib/text2sql/ask";

import { ApiKeyDialog } from "./ApiKeyDialog";
import { ChartView } from "./ChartView";
import { QueryInput } from "./QueryInput";
import { SqlViewer } from "./SqlViewer";
import { useApiKey } from "./use-api-key";

const MESSAGE_STYLES: Record<"clarify" | "rejected" | "error", string> = {
  clarify: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  rejected: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  error: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

function ResultView({ result }: { result: AskResult }) {
  if (result.kind === "result") {
    return (
      <div className="flex flex-col gap-4">
        <SqlViewer sql={result.sql} explanation={result.explanation} />
        <ChartView columns={result.columns} rows={result.rows} truncated={result.truncated} vizHint={result.vizHint} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-lg border px-4 py-3 text-sm ${MESSAGE_STYLES[result.kind]}`} role="status">
        {result.message}
      </div>
      {"sql" in result && result.sql ? <SqlViewer sql={result.sql} /> : null}
    </div>
  );
}

export function QueryContainer() {
  const { apiKey, model, isLoaded, setApiKey, setModel } = useApiKey();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasKey = apiKey.length > 0;
  const showKeyPrompt = isLoaded && !hasKey;

  const handleSubmit = (question: string) => {
    if (!hasKey) {
      setDialogOpen(true);
      return;
    }
    startTransition(async () => {
      const next = await askAction({ question, model, apiKey });
      setResult(next);
    });
  };

  const handleSave = (next: { model: string; apiKey: string }) => {
    setModel(next.model);
    setApiKey(next.apiKey);
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Ask the World Cup 2022</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">자연어 질문 → SQL → 2022 카타르 월드컵 데이터</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/bracket"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            🏆 대진표
          </Link>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ⚙ {hasKey ? model : "API 설정"}
          </button>
        </div>
      </header>

      {showKeyPrompt ? (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          시작하려면 우측 상단 <strong>⚙ API 설정</strong>에서 본인 API 키를 입력하세요 (브라우저에만 저장).
        </div>
      ) : null}

      <QueryInput isPending={isPending} onSubmit={handleSubmit} />

      {result ? <ResultView result={result} /> : null}

      <ApiKeyDialog
        open={dialogOpen}
        model={model}
        apiKey={apiKey}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
