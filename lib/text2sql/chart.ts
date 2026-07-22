// Output routing (PRD §6.1). The APP decides how to render a result from its
// real shape — the LLM's viz_hint is only honored when it's actually compatible
// with the data, and a table is always the fallback. Pure + client-safe so both
// the chooser and its tests run anywhere.

export type ChartKind = "table" | "scalar" | "bar" | "line" | "pie";
type ChartHint = "bar" | "line" | "pie";

const MAX_CHART_ROWS = 40;
const MAX_PIE_SLICES = 8;

function isChartHint(hint: string | undefined): hint is ChartHint {
  return hint === "bar" || hint === "line" || hint === "pie";
}

export interface ColumnRoles {
  categoryIndex: number | null; // first non-numeric column (labels)
  numericIndices: number[]; // columns whose values are all numbers
}

function isNumericColumn(rows: unknown[][], colIndex: number): boolean {
  let sawValue = false;
  for (const row of rows) {
    const cell = row[colIndex];
    if (cell === null || cell === undefined) continue;
    sawValue = true;
    if (typeof cell !== "number") return false;
  }
  return sawValue;
}

export function detectRoles(columns: string[], rows: unknown[][]): ColumnRoles {
  const numericIndices: number[] = [];
  let categoryIndex: number | null = null;
  for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
    if (isNumericColumn(rows, colIndex)) {
      numericIndices.push(colIndex);
    } else if (categoryIndex === null) {
      categoryIndex = colIndex;
    }
  }
  return { categoryIndex, numericIndices };
}

function shapeSupports(kind: ChartHint, roles: ColumnRoles, rowCount: number): boolean {
  const hasCategory = roles.categoryIndex !== null;
  const hasNumeric = roles.numericIndices.length >= 1;
  const withinChartRows = rowCount >= 1 && rowCount <= MAX_CHART_ROWS;
  if (kind === "bar" || kind === "line") return hasCategory && hasNumeric && withinChartRows;
  if (kind === "pie") {
    const singleNumeric = roles.numericIndices.length === 1;
    const withinSlices = rowCount >= 1 && rowCount <= MAX_PIE_SLICES;
    return hasCategory && singleNumeric && withinSlices;
  }
  return false;
}

// Pure routing over precomputed roles + counts, so a caller that already has the
// roles (the renderer) doesn't recompute detectRoles.
export function classifyChart(roles: ColumnRoles, rowCount: number, columnCount: number, vizHint?: string): ChartKind {
  if (rowCount === 0) return "table";

  const isScalar = columnCount === 1 && rowCount === 1;
  if (isScalar) return "scalar";

  // A compatible LLM hint wins (it can pick pie/line where a bar is not ideal).
  if (isChartHint(vizHint) && shapeSupports(vizHint, roles, rowCount)) return vizHint;

  // No usable hint: auto-bar only the classic aggregate shape — the first column
  // is the label and there is exactly one numeric column (e.g. "team, goals").
  // Requiring category-first + a single number keeps detail rows (ids, many
  // numeric columns) from being charted nonsensically; those stay tables.
  const isCleanAggregate = roles.categoryIndex === 0 && roles.numericIndices.length === 1;
  if (isCleanAggregate && shapeSupports("bar", roles, rowCount)) return "bar";

  return "table";
}

export function chooseChart(columns: string[], rows: unknown[][], vizHint?: string): ChartKind {
  return classifyChart(detectRoles(columns, rows), rows.length, columns.length, vizHint);
}
