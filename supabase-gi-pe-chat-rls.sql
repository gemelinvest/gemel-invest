-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for gi_chat_messages (authenticated)
-- Today: "gi_chat_messages_all" (anon,authenticated, ALL, true). Open to anon.
-- Actual columns: id, conversation_id, sender_id, sender_name, recipient_id,
--   recipient_name, body, created_at, expires_at.
-- A message is "owned" if sender_id = gi_jwt_agent_id() OR
-- recipient_id = gi_jwt_agent_id(). Managers see all.
-- INERT until Pה. Safe to run now.
-- =============================================================================

drop policy if exists "chat_select_authenticated" on public.gi_chat_messages;
create policy "chat_select_authenticated"
  on public.gi_chat_messages
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and (
             coalesce(sender_id, '')    = public.gi_jwt_agent_id()
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
     or (public.gi_jwt_agent_id() <> '' and coalesce(sender_id, '') = public.gi_jwt_agent_id())
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
