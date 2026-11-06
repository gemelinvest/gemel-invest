-- =============================================================================
-- GEMEL INVEST · copy one existing agent address onto his sign-in account.
--
-- Account: חן מזרחי only.
-- The address is read from his agent row. It is not written in this file
-- and it is not returned in the result.
--
-- His username-and-code login stays. This does not turn on the authenticator,
-- does not change his code, and does not touch any other account.
--
-- If the editor warns about a temporary table, choose Run without RLS.
-- =============================================================================

drop table if exists gi_email_result;
create temp table gi_email_result (
  kind text,
  detail text
);

do $$
declare
  v_agent_id text := 'a_42b897c014fd4_1a0a94d314a';
  v_user uuid := '5a22aa9e-0520-465a-83a3-8b0bd7291c37';
  v_email text;
  v_current text;
  v_status text;
begin
  select lower(btrim(coalesce(a.email, '')))
    into v_email
  from public.agents a
  where a.id = v_agent_id
    and a.name = 'חן מזרחי';

  if v_email is null then
    raise exception 'agent row was not found; nothing was changed';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'agent row has no usable address; nothing was changed';
  end if;

  select lower(btrim(coalesce(u.email, '')))
    into v_current
  from auth.users u
  where u.id = v_user;

  if v_current is null then
    raise exception 'sign-in account was not found; nothing was changed';
  end if;

  if v_current <> '' and v_current <> v_email then
    raise exception 'sign-in account already has a different address; nothing was changed';
  end if;

  if v_current = v_email then
    v_status := 'already_present';
  else
    begin
      update auth.users
         set email = v_email,
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = v_user
         and (email is null or btrim(email) = '');

      if exists (
        select 1 from auth.identities
        where user_id = v_user and provider = 'email'
      ) then
        update auth.identities
           set identity_data = jsonb_set(
                 jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email), true),
                 '{email_verified}', 'true'::jsonb, true
               ),
               provider_id = v_email,
               updated_at = now()
         where user_id = v_user
           and provider = 'email';
      else
        insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
        values (
          gen_random_uuid(),
          v_user,
          'email',
          v_email,
          jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true),
          now(),
          now()
        );
      end if;
    exception when unique_violation then
      raise exception 'another sign-in account already uses this address; nothing was changed';
    end;
    v_status := 'set';
  end if;

  insert into gi_email_result(kind, detail)
  values
    ('auth_email', v_status),
    ('code_login', 'unchanged');
end
$$;

select kind, detail
from gi_email_result
order by kind;
