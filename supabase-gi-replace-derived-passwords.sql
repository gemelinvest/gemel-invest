-- =============================================================================
-- GEMEL INVEST · section 1 of 2 · replace Auth passwords that were derived
-- from the CRM PIN.
--
-- Run this once, after the site no longer contains the password formula
-- (the app.js address contains giNoDerive=1) and after these four logins
-- were checked: אוריה, איתי, אפרת משה, חן מזרחי.
--
-- What this does
--   * Stops a later PIN edit from writing that derived password again.
--   * Gives every linked Auth user a new random password. The password is
--     not printed and is not stored in this file.
--   * Does not change CRM PINs, barcodes, emails, or the admin PIN.
--   * Does not close any open window. That is section 2, and only after
--     the same four logins work again.
--
-- If the warning dialog appears, choose Run without RLS. The result table
-- is temporary and holds counts only.
-- =============================================================================

drop table if exists gi_password_result;
create temp table gi_password_result (
  kind text,
  detail text
);

do $$
declare
  uid uuid;
  ids uuid[] := array[]::uuid[];
  replaced int := 0;
  agent_rec record;
begin
  if exists (
    select 1 from public.gi_app_secrets where key = 'derived_password_reset'
  ) then
    raise exception 'section 1 already ran; do not replace the passwords again';
  end if;

  create or replace function public.gi_sync_agent_auth_password()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  begin
    return new;
  end;
  $fn$;

  revoke all on function public.gi_sync_agent_auth_password() from public;

  for agent_rec in
    select a.id::text as agent_id, a.email, a.auth_user_id
    from public.agents a
  loop
    uid := agent_rec.auth_user_id;
    if uid is not null and not uid = any(ids) then
      ids := array_append(ids, uid);
    end if;
    begin
      uid := public.gi_pick_agent_auth_user(agent_rec.agent_id, agent_rec.email, agent_rec.auth_user_id);
    exception when undefined_function then
      uid := null;
    end;
    if uid is not null and not uid = any(ids) then
      ids := array_append(ids, uid);
    end if;
  end loop;

  if cardinality(ids) > 0 then
    update auth.users
       set encrypted_password = extensions.crypt(
             encode(extensions.gen_random_bytes(32), 'hex'),
             extensions.gen_salt('bf', 10)
           ),
           updated_at = now()
     where id = any(ids);
    get diagnostics replaced = row_count;
  end if;

  insert into public.gi_app_secrets (key, value)
  values (
    'derived_password_reset',
    jsonb_build_object(
      'authUserIds', coalesce(to_jsonb(ids), '[]'::jsonb),
      'replaced', replaced,
      'resetAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  insert into gi_password_result(kind, detail)
  values
    ('passwords_replaced', replaced::text),
    ('sessions_kept', 'yes'),
    ('pins_unchanged', 'yes');
end
$$;

select kind, detail
from gi_password_result
order by kind;
