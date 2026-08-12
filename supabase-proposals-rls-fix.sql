-- =============================================================================
-- GEMEL INVEST · Fix RLS on public.proposals
-- הרצה ב-Supabase SQL Editor (פעם אחת) אם שמירת הצעה נחסמת ב-RLS.
-- =============================================================================
-- מטרה:
-- 1) לאפשר ל-authenticated לקרוא/לכתוב הצעות עם agent_id שלהם
-- 2) לאפשר למנהלים (app_metadata.role = admin/manager/owner) גישה מלאה
-- 3) לאפשר SELECT אחרי INSERT/UPDATE (חובה ל-verifySavedRow באפליקציה)
-- =============================================================================

ALTER TABLE IF EXISTS public.proposals ENABLE ROW LEVEL SECURITY;

-- הסרת מדיניות ישנה עם שמות נפוצים (בטוח אם לא קיימת)
DROP POLICY IF EXISTS "proposals_select_own" ON public.proposals;
DROP POLICY IF EXISTS "proposals_insert_own" ON public.proposals;
DROP POLICY IF EXISTS "proposals_update_own" ON public.proposals;
DROP POLICY IF EXISTS "proposals_delete_own" ON public.proposals;
DROP POLICY IF EXISTS "proposals_all_authenticated" ON public.proposals;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.proposals;
DROP POLICY IF EXISTS "Enable write for authenticated users" ON public.proposals;

CREATE OR REPLACE FUNCTION public.gi_jwt_agent_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(trim(auth.jwt() -> 'app_metadata' ->> 'agent_id'), ''),
    NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'agent_id'), ''),
    NULLIF(trim(auth.jwt() -> 'app_metadata' ->> 'agentId'), ''),
    NULLIF(trim(auth.uid()::text), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.gi_jwt_is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  )) IN ('admin', 'owner', 'manager', 'adminlite', 'מנהל');
$$;

-- SELECT: בעלים או מנהל (נדרש גם לאימות אחרי שמירה)
CREATE POLICY "proposals_select_own"
ON public.proposals
FOR SELECT
TO authenticated
USING (
  public.gi_jwt_is_manager()
  OR COALESCE(agent_id, '') = ''
  OR agent_id = public.gi_jwt_agent_id()
);

-- INSERT
CREATE POLICY "proposals_insert_own"
ON public.proposals
FOR INSERT
TO authenticated
WITH CHECK (
  public.gi_jwt_is_manager()
  OR COALESCE(agent_id, '') = ''
  OR agent_id = public.gi_jwt_agent_id()
);

-- UPDATE (דורש גם USING וגם WITH CHECK)
CREATE POLICY "proposals_update_own"
ON public.proposals
FOR UPDATE
TO authenticated
USING (
  public.gi_jwt_is_manager()
  OR COALESCE(agent_id, '') = ''
  OR agent_id = public.gi_jwt_agent_id()
)
WITH CHECK (
  public.gi_jwt_is_manager()
  OR COALESCE(agent_id, '') = ''
  OR agent_id = public.gi_jwt_agent_id()
);

-- DELETE (אופציונלי לנציג על ההצעות שלו)
CREATE POLICY "proposals_delete_own"
ON public.proposals
FOR DELETE
TO authenticated
USING (
  public.gi_jwt_is_manager()
  OR agent_id = public.gi_jwt_agent_id()
);

-- הרשאות בסיס לטבלה
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;

NOTIFY pgrst, 'reload schema';
