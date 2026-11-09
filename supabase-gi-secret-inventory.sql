-- =============================================================================
-- GEMEL INVEST · read-only count before clearing leftover secrets.
--
-- Finding 2 still asks for three facts before any row is changed:
--   which active accounts already have a pin hash,
--   which active accounts still keep a clear code,
--   whether the settings row the screen reads still holds an admin code
--   or an authenticator secret.
--
-- Nothing is written. Codes, addresses, and authenticator secrets are not
-- selected. An account is listed only when blanking its clear code would
-- lock it out, or when the screen row still holds authenticator material
-- for it. The list shows a name, a role, and an id.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again. Do not run a second file from this result.
-- =============================================================================

drop table if exists gi_secret_inventory;
create temporary table gi_secret_inventory (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $inventory$
declare
  v_agents boolean;
  v_pin boolean;
  v_hash boolean;
  v_auth boolean;
  v_email boolean;
  v_meta boolean;
  v_payload boolean;
  v_secrets boolean;
  v_active integer := 0;
  v_with_hash integer := 0;
  v_clear integer := 0;
  v_ready integer := 0;
  v_blocked integer := 0;
  v_inactive_clear integer := 0;
  v_with_auth integer := 0;
  v_with_address integer := 0;
  v_without_auth integer := 0;
  v_admin_pin boolean := false;
  v_uri integer := 0;
  v_secret integer := 0;
  v_qr integer := 0;
  v_private_pin boolean := false;
  v_private_totp integer := 0;
  v_strip boolean := false;
  v_sort integer := 100;
  r record;
begin
  v_agents := to_regclass('public.agents') is not null;

  if not v_agents then
    insert into gi_secret_inventory(sort_key, section, detail) values
      (1, 'agents_table', 'no'),
      (90, 'changed', 'no');
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'pin'
  ) into v_pin;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'pin_hash'
  ) into v_hash;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'auth_user_id'
  ) into v_auth;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'email'
  ) into v_email;

  v_meta := to_regclass('public.app_meta') is not null;
  if v_meta then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'app_meta' and column_name = 'payload'
    ) into v_payload;
  end if;

  v_secrets := to_regclass('public.gi_app_secrets') is not null;

  execute 'select count(*) from public.agents where coalesce(active, true)' into v_active;

  if v_hash then
    execute $q$
      select count(*)
      from public.agents
      where coalesce(active, true)
        and nullif(btrim(coalesce(pin_hash, '')), '') is not null
    $q$ into v_with_hash;
  end if;

  if v_pin then
    execute $q$
      select
        count(*) filter (where coalesce(active, true)),
        count(*) filter (where not coalesce(active, true))
      from public.agents
      where nullif(btrim(coalesce(pin, '')), '') is not null
    $q$ into v_clear, v_inactive_clear;
  end if;

  if v_pin and v_hash then
    execute $q$
      select
        count(*) filter (
          where nullif(btrim(coalesce(pin_hash, '')), '') is not null
        ),
        count(*) filter (
          where nullif(btrim(coalesce(pin_hash, '')), '') is null
        )
      from public.agents
      where coalesce(active, true)
        and nullif(btrim(coalesce(pin, '')), '') is not null
    $q$ into v_ready, v_blocked;
  end if;

  if v_auth then
    execute $q$
      select
        count(*) filter (where auth_user_id is not null),
        count(*) filter (where auth_user_id is null)
      from public.agents
      where coalesce(active, true)
    $q$ into v_with_auth, v_without_auth;
  end if;

  if v_email then
    execute $q$
      select count(*)
      from public.agents
      where coalesce(active, true)
        and position('@' in btrim(coalesce(email, ''))) > 0
    $q$ into v_with_address;
  end if;

  if v_meta and v_payload then
    select exists (
      select 1
      from public.app_meta
      where key = 'global'
        and nullif(btrim(coalesce(payload #>> '{adminAuth,pin}', '')), '') is not null
    ) into v_admin_pin;

    select
      count(*) filter (
        where nullif(btrim(coalesce(e.value->>'totpUri', e.value->>'totp_uri', '')), '') is not null
      ),
      count(*) filter (
        where nullif(btrim(coalesce(e.value->>'totpSecret', e.value->>'totp_secret', '')), '') is not null
      ),
      count(*) filter (
        where nullif(btrim(coalesce(e.value->>'totpQrHtml', e.value->>'totp_qr_html', '')), '') is not null
      )
    into v_uri, v_secret, v_qr
    from public.app_meta m
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(m.payload->'agentSecurity') = 'object'
          then m.payload->'agentSecurity'
        else '{}'::jsonb
      end
    ) e
    where m.key = 'global';

    select exists (
      select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'app_meta'
        and t.tgname = 'trg_gi_strip_app_meta_secrets'
        and not t.tgisinternal
    ) into v_strip;
  end if;

  if v_secrets then
    select exists (
      select 1
      from public.gi_app_secrets
      where key = 'admin_auth'
        and nullif(btrim(coalesce(value->>'pin', '')), '') is not null
    ) into v_private_pin;

    select count(*)
    into v_private_totp
    from public.gi_app_secrets s
    cross join lateral jsonb_each(
      case
        when s.key = 'agent_totp' and jsonb_typeof(s.value) = 'object' then s.value
        else '{}'::jsonb
      end
    ) e
    where nullif(btrim(coalesce(e.value->>'totpUri', e.value->>'totp_uri', '')), '') is not null
       or nullif(btrim(coalesce(e.value->>'totpQrHtml', e.value->>'totp_qr_html', '')), '') is not null
       or nullif(btrim(coalesce(e.value->>'totpSecret', e.value->>'totp_secret', '')), '') is not null;
  end if;

  insert into gi_secret_inventory(sort_key, section, detail) values
    (1, 'agents_table', 'yes'),
    (2, 'pin_column', case when v_pin then 'yes' else 'no' end),
    (3, 'pin_hash_column', case when v_hash then 'yes' else 'no' end),
    (4, 'active', v_active::text),
    (5, 'active_with_hash', case when v_hash then v_with_hash::text else 'skipped' end),
    (6, 'active_clear_pin', case when v_pin then v_clear::text else 'skipped' end),
    (7, 'active_ready_to_blank', case when v_pin and v_hash then v_ready::text else 'skipped' end),
    (8, 'active_clear_without_hash', case when v_pin and v_hash then v_blocked::text else 'skipped' end),
    (9, 'inactive_clear_pin', case when v_pin then v_inactive_clear::text else 'skipped' end),
    (10, 'app_meta', case when v_meta then 'yes' else 'no' end),
    (11, 'readable_admin_pin', case when v_meta and v_payload then case when v_admin_pin then 'yes' else 'no' end else 'skipped' end),
    (12, 'readable_totp_uri', case when v_meta and v_payload then v_uri::text else 'skipped' end),
    (13, 'readable_totp_secret', case when v_meta and v_payload then v_secret::text else 'skipped' end),
    (14, 'readable_totp_qr', case when v_meta and v_payload then v_qr::text else 'skipped' end),
    (15, 'private_secrets_table', case when v_secrets then 'yes' else 'no' end),
    (16, 'private_admin_pin', case when v_secrets then case when v_private_pin then 'yes' else 'no' end else 'skipped' end),
    (17, 'private_totp_entries', case when v_secrets then v_private_totp::text else 'skipped' end),
    (18, 'strip_trigger', case when v_meta then case when v_strip then 'yes' else 'no' end else 'skipped' end),
    (19, 'auth_user_column', case when v_auth then 'yes' else 'no' end),
    (20, 'active_with_auth_user', case when v_auth then v_with_auth::text else 'skipped' end),
    (21, 'active_with_address', case when v_email then v_with_address::text else 'skipped' end),
    (22, 'active_without_auth_user', case when v_auth then v_without_auth::text else 'skipped' end),
    (90, 'changed', 'no');

  if v_pin and v_hash then
    for r in
      execute $q$
        select
          btrim(coalesce(name, '')) as agent_name,
          btrim(coalesce(role, '')) as agent_role,
          id::text as agent_id
        from public.agents
        where coalesce(active, true)
          and nullif(btrim(coalesce(pin, '')), '') is not null
          and nullif(btrim(coalesce(pin_hash, '')), '') is null
        order by 1, 3
      $q$
    loop
      v_sort := v_sort + 1;
      insert into gi_secret_inventory(sort_key, section, detail)
      values (
        v_sort,
        'clear_without_hash',
        r.agent_name || '|' || r.agent_role || '|' || r.agent_id
      );
    end loop;
  end if;

  if v_meta and v_payload then
    for r in
      select
        btrim(coalesce(a.name, '')) as agent_name,
        btrim(coalesce(a.role, '')) as agent_role,
        e.key as agent_id,
        case
          when nullif(btrim(coalesce(e.value->>'totpUri', e.value->>'totp_uri', '')), '') is not null
            then 'yes' else 'no'
        end as has_uri,
        case
          when nullif(btrim(coalesce(e.value->>'totpSecret', e.value->>'totp_secret', '')), '') is not null
            then 'yes' else 'no'
        end as has_secret,
        case
          when nullif(btrim(coalesce(e.value->>'totpQrHtml', e.value->>'totp_qr_html', '')), '') is not null
            then 'yes' else 'no'
        end as has_qr
      from public.app_meta m
      cross join lateral jsonb_each(
        case
          when jsonb_typeof(m.payload->'agentSecurity') = 'object'
            then m.payload->'agentSecurity'
          else '{}'::jsonb
        end
      ) e
      left join public.agents a on a.id::text = e.key
      where m.key = 'global'
        and (
          nullif(btrim(coalesce(e.value->>'totpUri', e.value->>'totp_uri', '')), '') is not null
          or nullif(btrim(coalesce(e.value->>'totpSecret', e.value->>'totp_secret', '')), '') is not null
          or nullif(btrim(coalesce(e.value->>'totpQrHtml', e.value->>'totp_qr_html', '')), '') is not null
        )
      order by 1, 3
    loop
      v_sort := v_sort + 1;
      insert into gi_secret_inventory(sort_key, section, detail)
      values (
        v_sort,
        'readable_totp',
        r.agent_name || '|' || r.agent_role || '|' || r.agent_id
          || '|uri=' || r.has_uri
          || '|secret=' || r.has_secret
          || '|qr=' || r.has_qr
      );
    end loop;
  end if;
end
$inventory$;

select section, detail
from gi_secret_inventory
order by sort_key, detail;
