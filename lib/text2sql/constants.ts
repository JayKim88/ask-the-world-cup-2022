// Client-safe constants (no Node-only imports), so both the server execution
// wrapper and client components can share them without pulling better-sqlite3
// into the browser bundle.

export const MAX_RESULT_ROWS = 1000;
