-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for gi_chat_messages (authenticated)
-- Today: "gi_chat_messages_all" (anon,authenticated, ALL, true). Open to anon.
-- Chat is SENSITIVE. Role matrix (§5): manager all; agent owns (agent_id = self
-- or participant); others minimal. INERT until Pה. Safe to run now.
-- NOTE: adjust column names (agent_id / sender_id / recipient_id) to match the
-- actual gi_chat_messages schema before applying — verify with:
--   select column_name from information_schema.columns where table_name='gi_chat_messages';
-- =============================================================================

drop policy if exists "chat_select_authenticated" on public.gi_chat_messages;
create policy "chat_select_authenticated"
  on public.gi_chat_messages
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and (
             coalesce(agent_id, '') = public.gi_jwt_agent_id()
          or coalesce(sender_id, '')  = public.gi_jwt_agent_id()
          or coalesce(recipient_id, '') = public.gi_jwt_agent_id()
        ))
  );

drop policy if exists "chat_insert_authenticated" on public.gi_chat_messages;
create policy "chat_insert_authenticated"
  on public.gi_chat_messages
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and (
             coalesce(agent_id, '') = public.gi_jwt_agent_id()
          or coalesce(sender_id, '')  = public.gi_jwt_agent_id()
        ))
  );

drop policy if exists "chat_update_authenticated" on public.gi_chat_messages;
create policy "chat_update_authenticated"
  on public.gi_chat_messages
  for update
  to authenticated
  using (public.gi_jwt_is_manager())
  with check (public.gi_jwt_is_manager());

drop policy if exists "chat_delete_authenticated" on public.gi_chat_messages;
create policy "chat_delete_authenticated"
  on public.gi_chat_messages
  for delete
  to authenticated
  using (public.gi_jwt_is_manager());

notify pgrst, 'reload schema';
-- Pה: drop "gi_chat_messages_all"; revoke all from anon.
