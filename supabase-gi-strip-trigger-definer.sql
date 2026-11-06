-- =============================================================================
-- GEMEL INVEST · let a settings-row save finish its existing cleanup.
--
-- Saving a customer file writes the customer first. The next step updates
-- the settings row, and that update runs the cleanup trigger. The browser
-- role is not allowed to call the cleanup function, so the settings update
-- stops with:
--   permission denied for function gi_strip_app_meta_payload
--
-- This file changes only the trigger function, so that same cleanup can
-- finish during the save. The cleanup itself is unchanged: it removes the
-- admin PIN and authenticator secrets from the settings row being written.
-- It does not read other tables, does not change sign-in, and does not write
-- any row by itself.
--
-- The browser still cannot call the cleanup function directly.
-- Running this file does not update a customer and does not reset a barcode.
--
-- Run once, after this change is merged. If the editor warns about RLS,
-- choose Run without RLS. Then check login, reopen the same customer file,
-- and save again. Do not reset a barcode in this check.
-- =============================================================================

create or replace function public.gi_strip_app_meta_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.payload := public.gi_strip_app_meta_payload(new.payload);
  return new;
end;
$$;

revoke all on function public.gi_strip_app_meta_row() from public, anon, authenticated;

notify pgrst, 'reload schema';
