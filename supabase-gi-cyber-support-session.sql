-- =============================================================================
-- GEMEL INVEST · a support token requires a signed-in session.
-- The public key cannot mint, list, act, or revoke. A signed-in screen can.
-- Login is not changed. Run this after supabase-gi-cyber-remaining-close.sql.
-- If the editor warns about a temporary table, choose Run without RLS.
--
-- Undo, only if a later check asks for it:
--   grant execute on function public.gi_rs_mint_actor_token(text, text) to anon, authenticated;
--   grant execute on function public.gi_rs_revoke_actor_token(text) to anon, authenticated;
--   grant execute on function public.gi_rs_list(text) to anon, authenticated;
--   grant execute on function public.gi_rs_action(text, text, uuid, jsonb) to anon, authenticated;
-- =============================================================================

drop table if exists gi_cyber_support_hold;
create temporary table gi_cyber_support_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_anon boolean;
begin
  if to_regprocedure('public.gi_rs_mint_actor_token(text, text)') is null then
    insert into gi_cyber_support_hold(sort_key, section, detail) values (30, 'remote_support', 'not_installed');
  else
    execute $fn$
      create or replace function public.gi_rs_mint_actor_token(p_agent_id text, p_pin text)
      returns jsonb language plpgsql security definer set search_path = public set row_security = off as $func$
      declare
        ag public.agents%rowtype; raw_token text;
        aid text := trim(both from coalesce(p_agent_id, ''));
        upin text := trim(both from coalesce(p_pin, ''));
      begin
        if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NO_SESSION'); end if;
        if aid = '' then return jsonb_build_object('ok', false, 'error', 'MISSING_CREDENTIALS'); end if;
        select a.* into ag from public.agents a
        where coalesce(a.active, true) = true
          and (a.id = aid or trim(both from coalesce(a.username, '')) = aid or trim(both from coalesce(a.name, '')) = aid)
        limit 1;
        if ag.id is null then return jsonb_build_object('ok', false, 'error', 'AGENT_NOT_FOUND'); end if;
        if upin <> '' and trim(both from coalesce(ag.pin, '0000')) <> upin then
          return jsonb_build_object('ok', false, 'error', 'BAD_PIN');
        end if;
        update public.gi_remote_support_actor_tokens set revoked_at = now()
        where agent_user_id = ag.id and revoked_at is null;
        raw_token := public.gi_rs_new_secret();
        insert into public.gi_remote_support_actor_tokens (agent_user_id, token_hash, expires_at)
        values (ag.id, public.gi_rs_hash_token(raw_token), now() + interval '12 hours');
        return jsonb_build_object('ok', true, 'token', raw_token, 'agentUserId', ag.id,
          'agentName', coalesce(ag.name, ''), 'role', coalesce(ag.role, 'agent'),
          'isSupportAdmin', public.gi_rs_role_is_support_admin(ag.role, ag.name),
          'expiresAt', (now() + interval '12 hours'));
      end; $func$
    $fn$;
    execute 'revoke all on function public.gi_rs_mint_actor_token(text, text) from public, anon';
    execute 'grant execute on function public.gi_rs_mint_actor_token(text, text) to authenticated';
    if to_regprocedure('public.gi_rs_revoke_actor_token(text)') is not null then
      execute 'revoke all on function public.gi_rs_revoke_actor_token(text) from public, anon';
      execute 'grant execute on function public.gi_rs_revoke_actor_token(text) to authenticated';
    end if;
    if to_regprocedure('public.gi_rs_list(text)') is not null then
      execute 'revoke all on function public.gi_rs_list(text) from public, anon';
      execute 'grant execute on function public.gi_rs_list(text) to authenticated';
    end if;
    if to_regprocedure('public.gi_rs_action(text, text, uuid, jsonb)') is not null then
      execute 'revoke all on function public.gi_rs_action(text, text, uuid, jsonb) from public, anon';
      execute 'grant execute on function public.gi_rs_action(text, text, uuid, jsonb) to authenticated';
    end if;
    select has_function_privilege('anon', 'public.gi_rs_mint_actor_token(text, text)', 'execute') into v_anon;
    if v_anon then raise exception 'anon can still mint a support token'; end if;
    insert into gi_cyber_support_hold(sort_key, section, detail) values
      (30, 'remote_support', 'signed_in'), (31, 'remote_support_anon', 'no');
  end if;
  insert into gi_cyber_support_hold(sort_key, section, detail) values (40, 'login', 'unchanged'), (41, 'answer', 'support_closed');
end
$body$;

select section, detail from gi_cyber_support_hold order by sort_key;
