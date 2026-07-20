-- Ask the World Cup 2022 — DB security (PRD §4.1)
-- Run in the Supabase SQL editor AFTER schema.sql + seeding.
--
-- Threat model: data is 100% public → confidentiality is a non-goal. Defend only
-- integrity (no writes), availability (no cost attacks), isolation (no pivot).
-- The app-level AST validator is the 1st layer (bypassable); THIS is the real boundary.

-- ── 1. anon = read-only, SELECT on the 5 app tables only ──────────────────────
-- (This project runs in its OWN isolated Supabase project — see PRD §4.1.
--  anon is the role behind the public API key. Data is public, so SELECT is fine.)
revoke all on all tables in schema public from anon;
grant usage on schema public to anon;
grant select on public.teams, public.matches, public.match_stats, public.goals, public.players to anon;

-- No write grants (insert/update/delete/DDL) → a DROP/DELETE that slips past the
-- app validator still fails here with "permission denied". Integrity holds.

-- ── 2. cost guard: kill long/expensive queries (DoS) ─────────────────────────
alter role anon set statement_timeout = '5000';        -- 5s hard cap

-- ── 3. execute_sql RPC — the app's single read path ──────────────────────────
-- SECURITY INVOKER (NOT definer): runs as the caller (anon), so anon's SELECT-only
-- grants + statement_timeout apply. A definer function would run as owner and
-- bypass these — never do that here.
-- Returns rows as json so the app gets column-agnostic results.
-- Row cap (LIMIT) is enforced app-side in the execution wrapper.
create or replace function public.execute_sql(query text)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  result json;
begin
  execute format('select coalesce(json_agg(row_to_json(t)), ''[]''::json) from (%s) as t', query)
    into result;
  return result;
end;
$$;

grant execute on function public.execute_sql(text) to anon;

-- ── 4. RLS: read-only tables, permissive SELECT (data is public) ─────────────
-- Not the main defense (grants + timeout are) — enabled so direct PostgREST table
-- access is also SELECT-only and explicit.
alter table teams       enable row level security;
alter table players     enable row level security;
alter table matches     enable row level security;
alter table match_stats enable row level security;
alter table goals       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['teams','players','matches','match_stats','goals'] loop
    execute format('drop policy if exists %I_select on %I', t, t);
    execute format('create policy %I_select on %I for select using (true)', t, t);
  end loop;
end $$;
