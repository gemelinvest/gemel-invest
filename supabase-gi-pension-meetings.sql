-- GEMEL INVEST · פגישות פנסיה של הסוקרת.
-- טבלה חדשה בלבד. לא משנה מדיניות של טבלאות קיימות.
-- בלי סשן אין שורות. מנהל רואה הכל. סוקרת רואה מה שיצרה. נציג רואה מה ששויך אליו.
-- הרצה: פעם אחת, ואפשר להריץ שוב. הרצה חוזרת מחליפה את מדיניות השורות
-- כדי שסוקרת מחוברת תוכל לשייך פגישה. פגישות קיימות לא נמחקות.
-- אם יש שגיאה, להדביק את שורת ה-ERROR.

create table if not exists public.gi_pension_meetings (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_id text not null default '',
  created_by_name text not null default '',
  assignee_id text not null default '',
  assignee_name text not null default '',
  customer_id text not null default '',
  customer_name text not null default '',
  id_number text not null default '',
  meeting_date date,
  answers jsonb not null default '{}'::jsonb,
  notes text not null default '',
  masleka jsonb not null default '{}'::jsonb,
  masleka_file jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  close_choice text not null default '',
  pension_file_opened boolean not null default false
);

alter table public.gi_pension_meetings enable row level security;

revoke all on table public.gi_pension_meetings from public, anon;
grant select, insert, update on table public.gi_pension_meetings to authenticated;

-- סוקרת יכולה לפתוח פגישה על עצמה גם כשהתפקיד בטוקן הוא סוקרת / רפרנטית,
-- וגם כשהטוקן עדיין אומר "נציג" אבל שורת הסוכן כבר סוקרת.
create or replace function public.gi_meeting_writer(creator text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.gi_jwt_is_manager()
    or (
      coalesce(btrim(creator), '') <> ''
      and (
        btrim(creator) = coalesce(public.gi_jwt_agent_id(), '')
        or exists (
          select 1
          from public.agents a
          where a.id = btrim(creator)
            and auth.uid() is not null
            and a.auth_user_id::text = auth.uid()::text
        )
      )
      and (
        lower(btrim(coalesce(public.gi_jwt_role(), ''))) in (
          'referent', 'סוקרת', 'רפרנטית',
          'manager', 'admin', 'owner', 'adminlite',
          'מנהל', 'מנהל מערכת', 'מפתח המערכת'
        )
        or exists (
          select 1
          from public.agents a
          where lower(btrim(coalesce(a.role, ''))) in (
            'referent', 'סוקרת', 'רפרנטית',
            'manager', 'admin', 'owner', 'adminlite',
            'מנהל', 'מנהל מערכת', 'מפתח המערכת'
          )
          and (
            a.id = nullif(btrim(coalesce(public.gi_jwt_agent_id(), '')), '')
            or (
              auth.uid() is not null
              and a.auth_user_id::text = auth.uid()::text
            )
          )
        )
      )
    );
$$;

revoke all on function public.gi_meeting_writer(text) from public, anon;
grant execute on function public.gi_meeting_writer(text) to authenticated;

drop policy if exists gi_pension_meetings_select on public.gi_pension_meetings;
create policy gi_pension_meetings_select
  on public.gi_pension_meetings
  for select
  to authenticated
  using (
    public.gi_jwt_is_manager()
    or created_by_id = public.gi_jwt_agent_id()
    or assignee_id = public.gi_jwt_agent_id()
    or exists (
      select 1
      from public.agents a
      where auth.uid() is not null
        and a.auth_user_id::text = auth.uid()::text
        and (a.id = created_by_id or a.id = assignee_id)
    )
  );

drop policy if exists gi_pension_meetings_insert on public.gi_pension_meetings;
create policy gi_pension_meetings_insert
  on public.gi_pension_meetings
  for insert
  to authenticated
  with check (public.gi_meeting_writer(created_by_id));

drop policy if exists gi_pension_meetings_update on public.gi_pension_meetings;
create policy gi_pension_meetings_update
  on public.gi_pension_meetings
  for update
  to authenticated
  using (
    public.gi_jwt_is_manager()
    or created_by_id = public.gi_jwt_agent_id()
    or assignee_id = public.gi_jwt_agent_id()
    or exists (
      select 1
      from public.agents a
      where auth.uid() is not null
        and a.auth_user_id::text = auth.uid()::text
        and (a.id = created_by_id or a.id = assignee_id)
    )
  )
  with check (
    public.gi_jwt_is_manager()
    or created_by_id = public.gi_jwt_agent_id()
    or assignee_id = public.gi_jwt_agent_id()
    or exists (
      select 1
      from public.agents a
      where auth.uid() is not null
        and a.auth_user_id::text = auth.uid()::text
        and (a.id = created_by_id or a.id = assignee_id)
    )
  );

-- איתור תיקים לפי תעודת זהות. סוקרת מקבלת רק לקוחות של נציגים בסניף שלה.
create or replace function public.gi_meeting_lookup_customers(id_numbers text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me text := public.gi_jwt_agent_id();
  v_manager boolean := public.gi_jwt_is_manager();
  v_role text := public.gi_jwt_role();
  v_branch text := '';
  v_map jsonb := '{}'::jsonb;
  v_norm text[];
begin
  if auth.uid() is null or coalesce(v_me, '') = '' then
    return '[]'::jsonb;
  end if;
  select coalesce(array_agg(distinct ltrim(regexp_replace(coalesce(x, ''), '[^0-9]', '', 'g'), '0')), array[]::text[])
    into v_norm
  from unnest(coalesce(id_numbers, array[]::text[])) as x
  where ltrim(regexp_replace(coalesce(x, ''), '[^0-9]', '', 'g'), '0') <> '';

  if v_manager or v_role in ('admin', 'owner', 'manager', 'adminlite', 'ops', 'opsAgent') then
    return (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'id_number', c.id_number,
        'phone', c.phone,
        'city', c.city,
        'agent_id', c.agent_id,
        'agent_name', c.agent_name,
        'payload', c.payload
      )), '[]'::jsonb)
      from public.customers c
      where ltrim(regexp_replace(coalesce(c.id_number, ''), '[^0-9]', '', 'g'), '0') = any (v_norm)
    );
  end if;

  if v_role = 'agent' or v_role = 'teamManager' then
    return (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'id_number', c.id_number,
        'phone', c.phone,
        'city', c.city,
        'agent_id', c.agent_id,
        'agent_name', c.agent_name,
        'payload', c.payload
      )), '[]'::jsonb)
      from public.customers c
      where c.agent_id::text = v_me
        and ltrim(regexp_replace(coalesce(c.id_number, ''), '[^0-9]', '', 'g'), '0') = any (v_norm)
    );
  end if;

  if v_role in ('referent', 'סוקרת', 'רפרנטית') then
    return (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'id_number', c.id_number,
        'phone', c.phone,
        'city', c.city,
        'agent_id', c.agent_id,
        'agent_name', c.agent_name,
        'payload', c.payload
      )), '[]'::jsonb)
      from public.customers c
      where ltrim(regexp_replace(coalesce(c.id_number, ''), '[^0-9]', '', 'g'), '0') = any (v_norm)
    );
  end if;

  return '[]'::jsonb;
end;
$$;

revoke all on function public.gi_meeting_lookup_customers(text[]) from public, anon;
grant execute on function public.gi_meeting_lookup_customers(text[]) to authenticated;

notify pgrst, 'reload schema';
