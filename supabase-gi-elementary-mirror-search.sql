-- =============================================================================
-- GEMEL INVEST · elementary mirror search can read any customer.
--
-- The elementary mirror screen asks for a customer by name, id number, or
-- phone. The customers table policies still let an elementary user read
-- only their own row and a row whose agent_role is elementary. A customer
-- that belongs to a sales agent therefore never reaches that search.
--
-- This file adds two functions and nothing else:
--   gi_elementary_mirror_search_customers — returns matching customer rows
--     for an active elementary user. It does not change who can select
--     from public.customers.
--   gi_elementary_mirror_save_flow — writes only payload.mirrorFlow on one
--     customer. It does not change the name, phone, agent, or any other
--     column.
-- Both refuse every caller who is not an active elementary user on
-- public.agents. No policy is created or dropped. No customer row is read
-- or written by this script.
--
-- Safe to run again. Run it as one transaction. If the check at the end
-- fails, nothing from this script is saved.
-- =============================================================================

-- @statement
create or replace function public.gi_caller_is_elementary_roster()
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
      and lower(btrim(coalesce(a.role, ''))) in ('elementary', 'אלמנטרי')
      and (
        a.auth_user_id = auth.uid()
        or a.id = nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'agent_id', '')), '')
      )
  );
$$;

-- @statement
revoke all on function public.gi_caller_is_elementary_roster() from public;

-- @statement
revoke all on function public.gi_caller_is_elementary_roster() from anon;

-- @statement
grant execute on function public.gi_caller_is_elementary_roster() to authenticated;

-- @statement
create or replace function public.gi_elementary_mirror_search_customers(
  p_query text,
  p_limit integer default 40
)
returns setof public.customers
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text;
  v_digits text;
  v_take integer;
begin
  if public.gi_caller_is_elementary_roster() is distinct from true then
    return;
  end if;
  v_q := btrim(coalesce(p_query, ''));
  v_q := replace(replace(replace(v_q, '\', ''), '%', ''), '_', '');
  v_q := left(v_q, 80);
  if length(v_q) < 2 then
    return;
  end if;
  v_take := least(40, greatest(1, coalesce(p_limit, 40)));
  v_digits := regexp_replace(v_q, '\D', '', 'g');
  return query
  select c.*
  from public.customers c
  where coalesce(c.is_archived, false) = false
    and lower(coalesce(c.status, '')) not in ('inactive', 'archived', 'purged')
    and coalesce(c.status, '') <> 'גנוז'
    and (
      coalesce(c.full_name, '') ilike '%' || v_q || '%'
      or coalesce(c.id_number, '') ilike '%' || v_q || '%'
      or coalesce(c.phone, '') ilike '%' || v_q || '%'
      or (
        length(v_digits) >= 7
        and (
          regexp_replace(coalesce(c.id_number, ''), '\D', '', 'g') like '%' || v_digits || '%'
          or regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
        )
      )
    )
  order by c.updated_at desc nulls last
  limit v_take;
end;
$$;

-- @statement
revoke all on function public.gi_elementary_mirror_search_customers(text, integer) from public;

-- @statement
revoke all on function public.gi_elementary_mirror_search_customers(text, integer) from anon;

-- @statement
grant execute on function public.gi_elementary_mirror_search_customers(text, integer) to authenticated;

-- @statement
create or replace function public.gi_elementary_mirror_save_flow(
  p_id text,
  p_mirror_flow jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id text;
  v_flow jsonb;
begin
  if public.gi_caller_is_elementary_roster() is distinct from true then
    return false;
  end if;
  v_id := btrim(coalesce(p_id, ''));
  if v_id = '' or left(v_id, 6) = 'emref_' or left(v_id, 7) = 'emprop_' then
    return false;
  end if;
  if jsonb_typeof(p_mirror_flow) is distinct from 'object' then
    return false;
  end if;
  if octet_length(p_mirror_flow::text) > 400000 then
    return false;
  end if;
  v_flow := p_mirror_flow;
  update public.customers c
  set payload = jsonb_set(
        case
          when jsonb_typeof(coalesce(c.payload, '{}'::jsonb)) = 'object'
          then coalesce(c.payload, '{}'::jsonb)
          else '{}'::jsonb
        end,
        '{mirrorFlow}',
        case
          when jsonb_typeof(coalesce(c.payload, '{}'::jsonb) -> 'mirrorFlow') = 'object'
          then (c.payload -> 'mirrorFlow') || v_flow
          else v_flow
        end,
        true
      ),
      updated_at = now()
  where c.id::text = v_id
    and coalesce(c.is_archived, false) = false
    and lower(coalesce(c.status, '')) not in ('inactive', 'archived', 'purged')
    and coalesce(c.status, '') <> 'גנוז';
  return found;
end;
$$;

-- @statement
revoke all on function public.gi_elementary_mirror_save_flow(text, jsonb) from public;

-- @statement
revoke all on function public.gi_elementary_mirror_save_flow(text, jsonb) from anon;

-- @statement
grant execute on function public.gi_elementary_mirror_save_flow(text, jsonb) to authenticated;

-- @statement
do $check$
declare
  v_search text;
  v_save text;
  v_who text;
begin
  if to_regprocedure('public.gi_caller_is_elementary_roster()') is null then
    raise exception 'gi_caller_is_elementary_roster is missing; nothing saved';
  end if;
  if to_regprocedure('public.gi_elementary_mirror_search_customers(text, integer)') is null then
    raise exception 'gi_elementary_mirror_search_customers is missing; nothing saved';
  end if;
  if to_regprocedure('public.gi_elementary_mirror_save_flow(text, jsonb)') is null then
    raise exception 'gi_elementary_mirror_save_flow is missing; nothing saved';
  end if;

  v_who := lower(pg_get_functiondef(to_regprocedure('public.gi_caller_is_elementary_roster()')));
  if position('user_metadata' in v_who) > 0 then
    raise exception 'elementary roster check reads a writable profile field; nothing saved';
  end if;
  if position('elementary' in v_who) = 0 then
    raise exception 'elementary roster check does not recognize the role; nothing saved';
  end if;

  v_search := lower(pg_get_functiondef(to_regprocedure('public.gi_elementary_mirror_search_customers(text, integer)')));
  if position('gi_caller_is_elementary_roster' in v_search) = 0 then
    raise exception 'mirror search does not check the elementary roster; nothing saved';
  end if;
  if position('security definer' in v_search) = 0 then
    raise exception 'mirror search is not security definer; nothing saved';
  end if;

  v_save := lower(pg_get_functiondef(to_regprocedure('public.gi_elementary_mirror_save_flow(text, jsonb)')));
  if position('gi_caller_is_elementary_roster' in v_save) = 0 then
    raise exception 'mirror save does not check the elementary roster; nothing saved';
  end if;
  if position('mirrorflow' in v_save) = 0 then
    raise exception 'mirror save does not write mirrorFlow; nothing saved';
  end if;
  if position('agent_id' in v_save) > 0 or position('full_name' in v_save) > 0 then
    raise exception 'mirror save touches a customer column it must not change; nothing saved';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname like 'gi_customers_elementary_mirror%'
  ) then
    raise exception 'a table policy was added for this search; nothing saved';
  end if;
end
$check$;
