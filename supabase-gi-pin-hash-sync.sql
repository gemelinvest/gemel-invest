-- =============================================================================
-- GEMEL INVEST · keep agents.pin_hash in sync when agents.pin changes
--
-- gi_verify_agent_login prefers pin_hash over the clear-text pin column.
-- Updating agents.pin (CRM persist / gi-provision-agent-auth) without
-- rewriting pin_hash left the old hash in place, so the typed PIN failed
-- even when the pin column already held the new value.
--
-- This trigger rehashes only when pin is set to a non-empty value.
-- Clearing pin (R9-pre-B hide plaintext) leaves the existing hash intact.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.gi_sync_agent_pin_hash()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and new.pin is not distinct from old.pin then
    return new;
  end if;
  if new.pin is not null and btrim(new.pin) <> '' then
    new.pin_hash := extensions.crypt(btrim(new.pin), extensions.gen_salt('bf', 8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gi_sync_agent_pin_hash on public.agents;
create trigger trg_gi_sync_agent_pin_hash
  before insert or update of pin on public.agents
  for each row
  execute function public.gi_sync_agent_pin_hash();

revoke all on function public.gi_sync_agent_pin_hash() from public;

notify pgrst, 'reload schema';
