-- GoTrue rejects admin reads when token columns are NULL
-- ("converting NULL to string is unsupported"). That 500s
-- gi-open-agent-session, so an ops agent stays anonymous and the
-- plasma radio PATCH never runs.
-- Repair existing rows, and let the session function heal a user
-- before it asks GoTrue to read them.

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_new is null
   or email_change is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

create or replace function public.gi_repair_auth_null_tokens(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  update auth.users
  set
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
  where id = p_user_id
    and (
      confirmation_token is null
      or recovery_token is null
      or email_change_token_new is null
      or email_change is null
      or email_change_token_current is null
      or phone_change is null
      or phone_change_token is null
      or reauthentication_token is null
    );
end;
$$;

revoke all on function public.gi_repair_auth_null_tokens(uuid) from public;
revoke all on function public.gi_repair_auth_null_tokens(uuid) from anon;
revoke all on function public.gi_repair_auth_null_tokens(uuid) from authenticated;
grant execute on function public.gi_repair_auth_null_tokens(uuid) to service_role;
