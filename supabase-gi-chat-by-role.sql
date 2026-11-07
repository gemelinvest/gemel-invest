-- =============================================================================
-- GEMEL INVEST · narrow chat messages to the people in the conversation.
--
-- public.gi_chat_messages has an open signed-in policy,
-- gi_chat_messages_all_authenticated. It lets every signed-in person read
-- and change every message. The select and insert policies beside it are
-- limited, but update and delete name only gi_jwt_is_manager(). That
-- helper includes a regular manager, so those two policies would let a
-- manager read nothing new while still being the wrong write rule.
--
-- The screen reads a message when the person is the sender or the
-- recipient, sends a message with their own sender id, and deletes a
-- message only after it expires. An admin or an owner can still read
-- and write every message. A regular manager, an operations user, and a
-- team manager keep only the conversations they are in.
--
-- This file rewrites the four policies and removes the open one.
-- No other table is touched. Messages are not read and are not changed.
--
-- The swap happens only when row security is on, sender_id, recipient_id,
-- and expires_at exist, the five known policies are the whole set, and
-- the helpers exist. If the new policies are missing afterwards, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_chat_messages_all_authenticated
--     on public.gi_chat_messages
--     for all to authenticated
--     using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_chat_by_role;
create temporary table gi_rls_chat_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_rls boolean;
  v_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_blank boolean;
  v_read text := $pred$
        public.gi_jwt_role() in ('admin', 'owner')
        or (
          public.gi_jwt_agent_id() <> ''
          and (
            coalesce(sender_id, '') = public.gi_jwt_agent_id()
            or coalesce(recipient_id, '') = public.gi_jwt_agent_id()
          )
        )
  $pred$;
  v_send text := $pred$
        public.gi_jwt_role() in ('admin', 'owner')
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(sender_id, '') = public.gi_jwt_agent_id()
        )
  $pred$;
  v_edit text := $pred$
        public.gi_jwt_role() in ('admin', 'owner')
  $pred$;
  v_drop text := $pred$
        public.gi_jwt_role() in ('admin', 'owner')
        or (
          public.gi_jwt_agent_id() <> ''
          and expires_at < now()
          and (
            coalesce(sender_id, '') = public.gi_jwt_agent_id()
            or coalesce(recipient_id, '') = public.gi_jwt_agent_id()
          )
        )
  $pred$;
begin
  if to_regclass('public.gi_chat_messages') is null then
    raise exception 'chat table is missing; nothing saved';
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

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_chat_messages' and column_name = 'sender_id'
  ) then
    raise exception 'sender_id column is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_chat_messages' and column_name = 'recipient_id'
  ) then
    raise exception 'recipient_id column is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_chat_messages' and column_name = 'expires_at'
  ) then
    raise exception 'expires_at column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_agent_id()') is null
     or to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_chat_messages'
      and policyname = 'gi_chat_messages_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_chat_messages';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_chat_messages'
      and (
        coalesce(qual, '') ~ $re$(sender_id|recipient_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(sender_id|recipient_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*(sender_id|recipient_id)[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*(sender_id|recipient_id)[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and not v_blank and v_count = 4
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_chat_messages'
         and policyname = 'chat_select_authenticated'
         and cmd = 'SELECT'
         and coalesce(qual, '') like '%''admin''%'
         and coalesce(qual, '') like '%''owner''%'
         and coalesce(qual, '') like '%sender_id%'
         and coalesce(qual, '') like '%recipient_id%'
         and coalesce(qual, '') !~ 'gi_jwt_is_manager'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_chat_messages'
         and policyname = 'chat_delete_authenticated'
         and cmd = 'DELETE'
         and coalesce(qual, '') like '%expires_at%'
     ) then
    insert into gi_rls_chat_by_role(sort_key, section, detail) values
      (1, 'table', 'gi_chat_messages'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_party', 'closed'),
      (6, 'changed', 'no');
    return;
  end if;

  if not v_open or v_count <> 5 then
    raise exception 'chat policies are not the expected open set; nothing saved';
  end if;

  if not exists (
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
    raise exception 'a chat policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_chat_messages'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_chat_messages';

  drop policy chat_select_authenticated on public.gi_chat_messages;
  drop policy chat_insert_authenticated on public.gi_chat_messages;
  drop policy chat_update_authenticated on public.gi_chat_messages;
  drop policy chat_delete_authenticated on public.gi_chat_messages;

  execute 'create policy chat_select_authenticated on public.gi_chat_messages for select to authenticated using (' || v_read || ')';
  execute 'create policy chat_insert_authenticated on public.gi_chat_messages for insert to authenticated with check (' || v_send || ')';
  execute 'create policy chat_update_authenticated on public.gi_chat_messages for update to authenticated using (' || v_edit || ') with check (' || v_edit || ')';
  execute 'create policy chat_delete_authenticated on public.gi_chat_messages for delete to authenticated using (' || v_drop || ')';

  drop policy gi_chat_messages_all_authenticated on public.gi_chat_messages;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%''admin''%'
      and coalesce(qual, '') like '%''owner''%'
      and coalesce(qual, '') like '%sender_id%'
      and coalesce(qual, '') like '%recipient_id%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
  ) into v_select_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_insert_authenticated'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%''admin''%'
      and coalesce(with_check, '') like '%sender_id%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
      and coalesce(with_check, '') !~ 'gi_jwt_is_manager'
      and coalesce(with_check, '') not like '%recipient_id%'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_update_authenticated'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%''admin''%'
      and coalesce(qual, '') like '%''owner''%'
      and coalesce(with_check, '') like '%''admin''%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
      and coalesce(qual, '') not like '%sender_id%'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'chat_delete_authenticated'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%''admin''%'
      and coalesce(qual, '') like '%expires_at%'
      and coalesce(qual, '') like '%sender_id%'
      and coalesce(qual, '') like '%recipient_id%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_chat_messages'
      and policyname = 'gi_chat_messages_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_chat_messages'
      and (
        coalesce(qual, '') ~ $re$(sender_id|recipient_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(sender_id|recipient_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*(sender_id|recipient_id)[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*(sender_id|recipient_id)[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'gi_chat_messages';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_chat_messages'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_chat_messages';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_blank or v_count <> 4 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the chat role path changed; nothing saved';
  end if;

  insert into gi_rls_chat_by_role(sort_key, section, detail) values
    (1, 'table', 'gi_chat_messages'),
    (2, 'policies_removed', 'gi_chat_messages_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_party', 'closed'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_chat_by_role
order by sort_key;
