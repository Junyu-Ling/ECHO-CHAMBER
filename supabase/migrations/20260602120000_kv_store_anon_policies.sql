-- Run once in Supabase Dashboard → SQL Editor
-- Allows the public site (anon key) to read/write song request data in kv_store_2914ec93

alter table public.kv_store_2914ec93 enable row level security;

drop policy if exists "anon_select_kv_requests" on public.kv_store_2914ec93;
drop policy if exists "anon_insert_kv_requests" on public.kv_store_2914ec93;
drop policy if exists "anon_update_kv_requests" on public.kv_store_2914ec93;
drop policy if exists "anon_delete_kv_requests" on public.kv_store_2914ec93;

create policy "anon_select_kv_requests"
  on public.kv_store_2914ec93 for select
  to anon, authenticated
  using (key like 'req:%');

create policy "anon_insert_kv_requests"
  on public.kv_store_2914ec93 for insert
  to anon, authenticated
  with check (key like 'req:%');

create policy "anon_update_kv_requests"
  on public.kv_store_2914ec93 for update
  to anon, authenticated
  using (key like 'req:%')
  with check (key like 'req:%');

create policy "anon_delete_kv_requests"
  on public.kv_store_2914ec93 for delete
  to anon, authenticated
  using (key like 'req:%');
