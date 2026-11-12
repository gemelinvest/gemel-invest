-- =============================================================================
-- GEMEL INVEST · mirror-call search follows the agents table, not a stale
-- sign-in role.
--
-- The mirror-call screen already asks the server for every customer when
-- the signed-in person is a נציג תפעול (agents.role = opsAgent). Two people
-- with that same role were not seeing the same customers. gi_jwt_role()
-- keeps the role stored on the sign-in token whenever that role is present,
-- and only then looks at public.agents. A token that still says "agent"
-- therefore returns only customers owned by that person, even after the
-- agents screen was changed to opsAgent.
--
-- This file does two things, and it does not read or change a customer row:
--   1. gi_jwt_role() still prefers a manager or operations token. When the
--      token is a weaker role, an active operations row in public.agents
--      (linked by auth.uid() or by the token's agent_id) supplies the role.
--   2. Three extra authenticated policies let that same operations row
--      read, insert, and update every customer. They sit beside the
--      existing policies. They do not replace them, and they are not
--      granted to anon.
--
-- Safe to run again. If the checks at the end fail, this script stops
-- and saves nothing when the editor runs it as one transaction.
-- =============================================================================

-- @statement
create or replace function public.gi_jwt_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with src as (
    select
      lower(coalesce(nullif(btrim(auth.jwt() -> 'app_metadata' ->> 'role'), ''), '')) as token_role,
      lower(coalesce((
        select a.role
        from public.agents a
        where coalesce(a.active, true) = true
          and (
            a.auth_user_id = auth.uid()
            or a.id = nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'agent_id', '')), '')
          )
        order by case when a.auth_user_id = auth.uid() then 0 else 1 end
        limit 1
      ), '')) as agent_role
  )
  select case
    when s.agent_role in ('ops', 'opsagent', 'ops_agent', 'תפעול', 'מנהל תפעול', 'נציג תפעול')
     and s.token_role not in (
       'admin', 'owner', 'manager', 'adminlite', 'מנהל',
       'ops', 'opsagent', 'ops_agent', 'תפעול', 'מנהל תפעול', 'נציג תפעול'
     )
    then case s.agent_role
      when 'ops_agent' then 'opsagent'
      when 'נציג תפעול' then 'opsagent'
      when 'מנהל תפעול' then 'ops'
      when 'תפעול' then 'ops'
      else s.agent_role
    end
    else coalesce(
      nullif(s.token_role, ''),
      nullif(case s.agent_role
        when 'ops_agent' then 'opsagent'
        when 'נציג תפעול' then 'opsagent'
        when 'מנהל תפעול' then 'ops'
        when 'תפעול' then 'ops'
        else s.agent_role
      end, ''),
      ''
    )
  end
  from src s;
$$;

-- @statement
revoke all on function public.gi_jwt_role() from public;

-- @statement
grant execute on function public.gi_jwt_role() to authenticated;

-- @statement
create or replace function public.gi_caller_is_ops_roster()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agents a
    where coalesce(a.active, true) = true
      and lower(btrim(coalesce(a.role, ''))) in (
        'ops', 'opsagent', 'ops_agent', 'תפעול', 'מנהל תפעול', 'נציג תפעול'
      )
      and (
        a.auth_user_id = auth.uid()
        or a.id = nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'agent_id', '')), '')
      )
  );
$$;

-- @statement
revoke all on function public.gi_caller_is_ops_roster() from public;

-- @statement
revoke all on function public.gi_caller_is_ops_roster() from anon;

-- @statement
grant execute on function public.gi_caller_is_ops_roster() to authenticated;

-- @statement
drop policy if exists gi_customers_ops_roster_select on public.customers;

-- @statement
create policy gi_customers_ops_roster_select
  on public.customers
  for select
  to authenticated
  using (public.gi_caller_is_ops_roster());

-- @statement
drop policy if exists gi_customers_ops_roster_insert on public.customers;

-- @statement
create policy gi_customers_ops_roster_insert
  on public.customers
  for insert
  to authenticated
  with check (public.gi_caller_is_ops_roster());

-- @statement
drop policy if exists gi_customers_ops_roster_update on public.customers;

-- @statement
create policy gi_customers_ops_roster_update
  on public.customers
  for update
  to authenticated
  using (public.gi_caller_is_ops_roster())
  with check (public.gi_caller_is_ops_roster());

-- @statement
do $check$
declare
  v_src text;
  v_select_roles text;
  v_insert_roles text;
  v_update_roles text;
begin
  if to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'gi_jwt_role is missing; nothing saved';
  end if;
  if to_regprocedure('public.gi_caller_is_ops_roster()') is null then
    raise exception 'gi_caller_is_ops_roster is missing; nothing saved';
  end if;

  v_src := lower(pg_get_functiondef(to_regprocedure('public.gi_jwt_role()')));
  if position('user_metadata' in v_src) > 0 then
    raise exception 'gi_jwt_role reads a writable profile field; nothing saved';
  end if;
  if position('public.agents' in v_src) = 0 then
    raise exception 'gi_jwt_role no longer reads the agents roster; nothing saved';
  end if;
  if position('app_metadata' in v_src) = 0 then
    raise exception 'gi_jwt_role no longer reads the sign-in token; nothing saved';
  end if;

  v_src := lower(pg_get_functiondef(to_regprocedure('public.gi_caller_is_ops_roster()')));
  if position('user_metadata' in v_src) > 0 then
    raise exception 'gi_caller_is_ops_roster reads a writable profile field; nothing saved';
  end if;
  if position('opsagent' in v_src) = 0 then
    raise exception 'gi_caller_is_ops_roster does not recognize an operations agent; nothing saved';
  end if;

  select case when 'authenticated' = any (roles) and not ('anon' = any (roles) or 'public' = any (roles)) then 'ok' else '' end
    into v_select_roles
  from pg_policies
  where schemaname = 'public'
    and tablename = 'customers'
    and policyname = 'gi_customers_ops_roster_select'
    and cmd = 'SELECT'
    and permissive::text in ('PERMISSIVE', 'true', 't');
  select case when 'authenticated' = any (roles) and not ('anon' = any (roles) or 'public' = any (roles)) then 'ok' else '' end
    into v_insert_roles
  from pg_policies
  where schemaname = 'public'
    and tablename = 'customers'
    and policyname = 'gi_customers_ops_roster_insert'
    and cmd = 'INSERT'
    and permissive::text in ('PERMISSIVE', 'true', 't');
  select case when 'authenticated' = any (roles) and not ('anon' = any (roles) or 'public' = any (roles)) then 'ok' else '' end
    into v_update_roles
  from pg_policies
  where schemaname = 'public'
    and tablename = 'customers'
    and policyname = 'gi_customers_ops_roster_update'
    and cmd = 'UPDATE'
    and permissive::text in ('PERMISSIVE', 'true', 't');

  if coalesce(v_select_roles, '') <> 'ok'
     or coalesce(v_insert_roles, '') <> 'ok'
     or coalesce(v_update_roles, '') <> 'ok' then
    raise exception 'operations customer policies are missing or too wide; nothing saved';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname like 'gi_customers_ops_roster_%'
      and ('anon' = any (roles) or 'public' = any (roles))
  ) then
    raise exception 'operations customer policies are open to anonymous; nothing saved';
  end if;
end
$check$;

-- @statement
notify pgrst, 'reload schema';
