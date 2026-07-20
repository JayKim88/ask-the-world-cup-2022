import { describe, expect, it } from "vitest";

import { mapResult } from "./generate";

describe("mapResult", () => {
  it("maps kind=sql to planned", () => {
    const r = mapResult({ kind: "sql", sql: "SELECT 1", explanation: "one", viz_hint: "bar" });
    expect(r).toEqual({ status: "planned", sql: "SELECT 1", explanation: "one", vizHint: "bar" });
  });

  it("maps kind=sql without a query to error (not a silent pass)", () => {
    expect(mapResult({ kind: "sql" }).status).toBe("error");
  });

  it("maps kind=clarify to clarify", () => {
    expect(mapResult({ kind: "clarify", message: "which team?" })).toEqual({
      status: "clarify",
      message: "which team?",
    });
  });

  it("maps kind=reject to rejected", () => {
    expect(mapResult({ kind: "reject", message: "not in the data" })).toEqual({
      status: "rejected",
      message: "not in the data",
    });
  });
});
