-- v3 Phase C: the dashboard now reads through authenticated API routes
-- (service role), so the browser's anon key no longer needs ANY table access.
-- Run in the Supabase SQL editor BEFORE sharing the dashboard URL.

drop policy if exists "anon can read expenses" on expenses;
drop policy if exists "anon can read categories" on categories;
