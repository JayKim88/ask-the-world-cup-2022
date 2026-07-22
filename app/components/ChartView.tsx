"use client";

// Result renderer (PRD §6/§6.1). classifyChart() picks the view from the real
// data shape (+ the LLM's viz_hint when compatible); a table is always reachable
// via the toggle and is the fallback for anything non-chartable.

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { classifyChart, detectRoles, type ChartKind, type ColumnRoles } from "@/lib/text2sql/chart";

import { ResultsTable } from "./ResultsTable";

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const CHART_HEIGHT = 320;
// zinc-400: legible on both light and dark backgrounds (Recharts has no theming).
const AXIS_TICK = { fontSize: 12, fill: "#a1a1aa" };
const GRID_PROPS = { strokeDasharray: "3 3", stroke: "#a1a1aa", strokeOpacity: 0.2 };
// Past this many bars, vertical x-labels crowd — switch to a horizontal layout.
const HORIZONTAL_BAR_THRESHOLD = 12;
const BAR_ROW_HEIGHT = 26;
const CATEGORY_AXIS_WIDTH = 100;

const colorAt = (index: number): string => CHART_COLORS[index % CHART_COLORS.length];

interface ChartViewProps {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
  vizHint?: string;
}

interface ChartModel {
  data: Record<string, unknown>[];
  categoryKey: string;
  numericKeys: string[];
}

// Reuses the roles the caller already computed (no second detectRoles pass).
function toChartModel(columns: string[], rows: unknown[][], roles: ColumnRoles): ChartModel {
  const categoryKey = roles.categoryIndex !== null ? columns[roles.categoryIndex] : "";
  const numericKeys = roles.numericIndices.map((index) => columns[index]);

  const data = rows.map((row) => {
    const point: Record<string, unknown> = {};
    if (roles.categoryIndex !== null) point[categoryKey] = row[roles.categoryIndex];
    roles.numericIndices.forEach((index) => {
      point[columns[index]] = row[index];
    });
    return point;
  });

  return { data, categoryKey, numericKeys };
}

function ScalarView({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 py-10 dark:border-zinc-800">
      <span className="text-5xl font-bold text-zinc-900 dark:text-zinc-50">{String(value)}</span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
    </div>
  );
}

function ToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const activeClass = active ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800";
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-md px-3 py-1 text-xs ${activeClass}`}>
      {label}
    </button>
  );
}

function ChartRender({ kind, model }: { kind: ChartKind; model: ChartModel }) {
  if (kind === "pie") {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie data={model.data} dataKey={model.numericKeys[0]} nameKey={model.categoryKey} outerRadius={120} label>
            {model.data.map((_, index) => (
              <Cell key={index} fill={colorAt(index)} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "line") {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={model.data}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={model.categoryKey} tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip />
          <Legend />
          {model.numericKeys.map((key, index) => (
            <Line key={key} type="monotone" dataKey={key} stroke={colorAt(index)} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const bars = model.numericKeys.map((key, index) => <Bar key={key} dataKey={key} fill={colorAt(index)} />);
  const isHorizontal = model.data.length > HORIZONTAL_BAR_THRESHOLD;

  if (isHorizontal) {
    const height = Math.max(CHART_HEIGHT, model.data.length * BAR_ROW_HEIGHT);
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={model.data} layout="vertical">
          <CartesianGrid {...GRID_PROPS} />
          <XAxis type="number" tick={AXIS_TICK} />
          <YAxis type="category" dataKey={model.categoryKey} tick={AXIS_TICK} width={CATEGORY_AXIS_WIDTH} />
          <Tooltip />
          <Legend />
          {bars}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={model.data}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={model.categoryKey} tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} />
        <Tooltip />
        <Legend />
        {bars}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartView({ columns, rows, truncated, vizHint }: ChartViewProps) {
  const roles = useMemo(() => detectRoles(columns, rows), [columns, rows]);
  const kind = useMemo(() => classifyChart(roles, rows.length, columns.length, vizHint), [roles, rows.length, columns.length, vizHint]);
  // Only build the (potentially large) chart model when a chart will actually use it.
  const model = useMemo(() => (kind === "table" || kind === "scalar" ? null : toChartModel(columns, rows, roles)), [kind, columns, rows, roles]);
  const [showTable, setShowTable] = useState(false);

  if (kind === "scalar") return <ScalarView label={columns[0]} value={rows[0]?.[0]} />;
  if (kind === "table" || !model) return <ResultsTable columns={columns} rows={rows} truncated={truncated} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-1">
        <ToggleButton label="차트" active={!showTable} onClick={() => setShowTable(false)} />
        <ToggleButton label="테이블" active={showTable} onClick={() => setShowTable(true)} />
      </div>
      {showTable ? <ResultsTable columns={columns} rows={rows} truncated={truncated} /> : <ChartRender kind={kind} model={model} />}
    </div>
  );
}
