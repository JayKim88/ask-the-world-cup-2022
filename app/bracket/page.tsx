import Link from "next/link";

import { getBracket } from "@/lib/bracket/query";

import { BracketTree } from "../components/BracketTree";

export const metadata = {
  title: "대진표 — Ask the World Cup 2022",
};

export default function BracketPage() {
  const matches = getBracket();

  return (
    <main className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-16">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">토너먼트 대진표</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">2022 카타르 월드컵 녹아웃 스테이지 · 재귀 CTE(next_match_id)로 구성</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← 질문하기
          </Link>
        </header>
        <BracketTree matches={matches} />
      </div>
    </main>
  );
}
