-- =============================================================================
-- GEMEL INVEST · section 2 of 2 · revoke sessions of the exposed accounts.
--
-- Run this only after section 1 (supabase-gi-rotate-exposed-secrets.sql)
-- and only after the admin has logged in with the new PIN.
--
-- Deletes Auth sessions and revokes refresh tokens for the user ids recorded
-- by section 1: the agents whose TOTP material was exposed, plus the admin
-- account when that username matches an agents row. No other user is logged
-- out. This does not change PINs, password derivation, or RLS.
--
-- Changing the admin PIN in section 1 already rejects the old PIN, including
-- when the admin has no Auth user.
-- =============================================================================

drop table if exists gi_revoke_result;
create temp table gi_revoke_result (
  kind text,
  detail text
);

do $$
declare
  ids uuid[] := array[]::uuid[];
  n_tok int := 0;
  n_sess int := 0;
begin
  if not exists (
    select 1 from public.gi_app_secrets where key = 'exposed_totp_reset'
  ) then
    raise exception 'section 1 has not been run';
  end if;

  select coalesce(array_agg(distinct x::uuid), array[]::uuid[])
    into ids
  from jsonb_array_elements_text(
    coalesce(
      (select value->'authUserIds'
         from public.gi_app_secrets
        where key = 'exposed_totp_reset'),
      '[]'::jsonb
    )
  ) as t(x)
  where x ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  if ids is null then
    ids := array[]::uuid[];
  end if;

  if cardinality(ids) > 0 then
    update auth.refresh_tokens
       set revoked = true
     where user_id = any(ids)
       and revoked = false;
    get diagnostics n_tok = row_count;

    delete from auth.sessions
     where user_id = any(ids);
    get diagnostics n_sess = row_count;
  end if;

  insert into gi_revoke_result(kind, detail)
  values
    ('users', cardinality(ids)::text),
    ('refresh_tokens_revoked', n_tok::text),
    ('sessions_deleted', n_sess::text);
end
$$;

select kind, detail
from gi_revoke_result
order by kind;
