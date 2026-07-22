"use client";

// Results table (PRD §6.1): the always-available fallback rendering for any
// query result. Rows are positional arrays aligned with `columns` (§4), so
// duplicate column names (home/away joins) render correctly.

import { MAX_RESULT_ROWS } from "@/lib/text2sql/constants";

interface ResultsTableProps {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function ResultsTable({ columns, rows, truncated }: ResultsTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">결과가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={`${column}-${index}`}
                  scope="col"
                  className="border-b border-zinc-200 px-3 py-2 text-left font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-950 dark:even:bg-zinc-900">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b border-zinc-100 px-3 py-2 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200">
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400">
        {rows.length}행
        {truncated ? ` (${MAX_RESULT_ROWS}행 상한에서 잘림)` : ""}
      </p>
    </div>
  );
}
