-- =============================================================================
-- GEMEL INVEST · R9-pre-B hide agents.pin from anon/authenticated clients
-- Prerequisite: gi_verify_agent_login is live and CRM login was verified.
--
-- IMPORTANT: table-level GRANT SELECT cannot be narrowed with REVOKE SELECT(pin).
-- We revoke table SELECT, then re-grant every public column except pin.
-- Admin CRM can still INSERT/UPDATE pin values.
-- Also scrubs legacy pins from app_meta.agentsShadow JSON.
-- =============================================================================

revoke select on table public.agents from anon, authenticated;

grant select (
  id, name, username, role, active, created_at, updated_at,
  birth_date, monthly_sales_target, email, team_manager_id, auth_user_id
) on table public.agents to anon, authenticated;

grant insert, update on table public.agents to anon, authenticated;
grant update (pin) on table public.agents to anon, authenticated;
grant insert (pin) on table public.agents to anon, authenticated;

update public.app_meta
set payload = jsonb_set(
  payload,
  '{agentsShadow}',
  coalesce((
    select jsonb_agg(
      case
        when jsonb_typeof(elem) = 'object' then (elem - 'pin')
        else elem
      end
    )
    from jsonb_array_elements(coalesce(payload->'agentsShadow', '[]'::jsonb)) as elem
  ), '[]'::jsonb),
  true
)
where payload ? 'agentsShadow';

notify pgrst, 'reload schema';
