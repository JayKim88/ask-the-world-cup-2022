"use client";

// Generated-SQL viewer (PRD §5/§6): shows the exact query that ran, plus the
// model's one-line explanation. This is a learning tool — seeing the SQL is the
// point — so it's always visible on a successful answer.

interface SqlViewerProps {
  sql: string;
  explanation?: string;
}

export function SqlViewer({ sql, explanation }: SqlViewerProps) {
  return (
    <figure className="flex flex-col gap-2">
      {explanation ? (
        <figcaption className="text-sm text-zinc-600 dark:text-zinc-400">{explanation}</figcaption>
      ) : null}
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100 dark:bg-zinc-950">
        <code>{sql}</code>
      </pre>
    </figure>
  );
}
