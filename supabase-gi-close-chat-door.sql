-- =============================================================================
-- GEMEL INVEST · close the public door on the chat messages table.
--
-- This file removes one policy, gi_chat_messages_all, from
-- public.gi_chat_messages. The signed-in path added by the previous file
-- stays, so a signed-in session can still read, insert, update, and delete.
-- The four signed-in policies stay. No other table is touched. Row security
-- is not switched on or off. Nothing is revoked. Messages are not
-- read into the result and are not changed.
--
-- The door is removed only when that signed-in path is already in place
-- and a signed-in session still sees the same rows afterwards. If the
-- signed-in count changes, the public door is not the expected shape, or
-- a public read or save would remain, the whole script stops and saves
-- nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_chat_messages_all
--     on public.gi_chat_messages
--     for all
--     to anon, authenticated
--     using (true)
--     with check (true);
-- =============================================================================

drop table if exists gi_rls_chat_close;
create temporary table gi_rls_chat_close (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_rls_after boolean;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_table_before integer := 0;
  v_table_after integer := 0;
  v_rows_before integer := 0;
  v_rows_after integer := 0;
  v_anon_before integer;
  v_anon_after integer;
  v_auth_before integer;
  v_auth_after integer;
  v_removed boolean := false;
  v_cmd text;
  v_qual text;
  v_check text;
  v_permissive text;
  v_roles text;
  v_has_anon boolean := false;
  v_anon_left integer := 0;
begin
  if to_regclass('public.gi_chat_messages') is null then
    raise exception 'chat messages table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_chat_messages';

  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_chat_messages'
    and p.policyname = 'gi_chat_messages_all_authenticated';

  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'ALL'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
     or v_roles <> 'authenticated' then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_select_authenticated'
      and cmd = 'SELECT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_insert_authenticated'
      and cmd = 'INSERT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_update_authenticated'
      and cmd = 'UPDATE' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_delete_authenticated'
      and cmd = 'DELETE' and 'authenticated' = any (roles)
  ) then
    raise exception 'chat policies are missing; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public' and tablename <> 'gi_chat_messages';

  select count(*) into v_table_before
  from pg_policies
  where schemaname = 'public' and tablename = 'gi_chat_messages';

  select count(*) into v_rows_before from public.gi_chat_messages;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_chat_messages'
    and p.policyname = 'gi_chat_messages_all';

  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'ALL'
       or v_has_anon is distinct from true
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
      raise exception 'open door shape is unexpected; nothing saved';
    end if;
  else
    select count(*) into v_anon_left
    from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_chat_messages'
      and permissive::text in ('PERMISSIVE', 'true', 't')
      and ('anon' = any (roles) or 'public' = any (roles))
      and (
        (cmd in ('ALL', 'SELECT') and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
        or (cmd in ('ALL', 'INSERT', 'UPDATE') and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true'))
        or (cmd = 'DELETE' and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
      );
    if v_anon_left > 0 then
      raise exception 'anon door is still open; nothing saved';
    end if;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_before from public.gi_chat_messages;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      v_auth_before := null;
  end;

  if v_auth_before is null then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_before from public.gi_chat_messages;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_anon_before := null;
    end;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_chat_messages'
      and policyname = 'gi_chat_messages_all'
  ) then
    execute 'drop policy "gi_chat_messages_all" on public.gi_chat_messages';
    v_removed := true;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'gi_chat_messages_all_authenticated' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_insert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_update_authenticated' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_delete_authenticated' and cmd = 'DELETE'
  ) then
    raise exception 'signed-in path disappeared; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_after from public.gi_chat_messages;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      v_auth_after := null;
  end;

  if v_auth_after is null or v_auth_after is distinct from v_auth_before then
    raise exception 'signed-in rows changed; nothing saved';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_after from public.gi_chat_messages;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_anon_after := null;
    end;
    if v_anon_after is null or v_anon_after <> 0 then
      raise exception 'anon door is still open; nothing saved';
    end if;
  end if;

  select count(*) into v_anon_left
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_chat_messages'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and ('anon' = any (roles) or 'public' = any (roles))
    and (
      (cmd in ('ALL', 'SELECT') and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
      or (cmd in ('ALL', 'INSERT', 'UPDATE') and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true'))
      or (cmd = 'DELETE' and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
    );

  if v_anon_left > 0 then
    raise exception 'anon door is still open; nothing saved';
  end if;

  select c.relrowsecurity into v_rls_after
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'gi_chat_messages';

  if v_rls_after is distinct from true then
    raise exception 'row security flag changed; nothing saved';
  end if;

  select count(*) into v_rows_after from public.gi_chat_messages;
  if v_rows_after <> v_rows_before then
    raise exception 'message rows changed; nothing saved';
  end if;

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public' and tablename <> 'gi_chat_messages';
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_table_after
  from pg_policies
  where schemaname = 'public' and tablename = 'gi_chat_messages';
  if v_removed and v_table_after <> v_table_before - 1 then
    raise exception 'more than the public door was removed; nothing saved';
  end if;
  if not v_removed and v_table_after <> v_table_before then
    raise exception 'chat policies changed; nothing saved';
  end if;

  insert into gi_rls_chat_close(sort_key, section, detail) values
    (1, 'table', 'gi_chat_messages'),
    (2, 'rls_enabled', 'yes'),
    (3, 'authenticated_rows', 'same'),
    (4, 'anon_rows', case
      when v_anon_before is null and v_anon_after is null then 'not_counted'
      when v_anon_before is not null and v_anon_before > 0 and v_anon_after = 0 then 'hidden'
      else 'already_hidden' end),
    (5, 'message_rows', 'unchanged'),
    (6, 'other_tables', 'unchanged'),
    (7, 'policies_removed', case when v_removed then 'gi_chat_messages_all' else 'none' end),
    (8, 'signed_in_all', 'kept'),
    (9, 'signed_in_policies', 'kept'),
    (10, 'door_closed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_chat_close
order by sort_key;
