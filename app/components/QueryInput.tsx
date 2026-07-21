"use client";

// Question input (PRD §5/§6). Owns only its own textarea text; hands the trimmed
// question up via onSubmit. Cmd/Ctrl+Enter submits. Example chips seed the box
// from the §3.1 question bank so first-time users have something to click.

import { useState } from "react";

const EXAMPLE_QUESTIONS = [
  "득점왕 TOP 10",
  "조별 순위를 승점·득실차로",
  "승부차기까지 간 경기",
  "아르헨티나의 우승까지 전체 경로",
];

interface QueryInputProps {
  isPending: boolean;
  onSubmit: (question: string) => void;
}

export function QueryInput({ isPending, onSubmit }: QueryInputProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const question = text.trim();
    if (!question || isPending) return;
    onSubmit(question);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isSubmitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
    if (isSubmitCombo) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {example}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="2022 월드컵에 대해 물어보세요 — 예: 카드를 가장 많이 받은 팀 TOP 5"
        aria-label="질문 입력"
        className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">⌘/Ctrl + Enter로 전송</span>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "생성 중…" : "질문하기"}
        </button>
      </div>
    </div>
  );
}
