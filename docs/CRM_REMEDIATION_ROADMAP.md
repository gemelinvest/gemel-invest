# מפת תיקונים מדורגת — GEMEL INVEST CRM

**מבוסס על:** [`CRM_ARCHITECTURE_AUDIT.md`](CRM_ARCHITECTURE_AUDIT.md) + אימות R1 ב־Production.  
**חשוב:** אף שלב כאן **לא הופעל** בפרודקשן במסגרת ה־Audit. הפעלת RLS לפני Auth אמיתי **תשבור את ה־CRM** (הלקוח רץ כ־anon).

---

## סדר ביצוע מומלץ

| עדיפות | מזהה | פעולה | סיכון שינוי | דורש אישור מפורש? | סטטוס |
|--------|------|--------|-------------|-------------------|--------|
| 0 | OPS | מחיקת שורת `__audit_probe_cust__` ב־SQL Editor (service role) | נמוך | כן (גישת service) | ממתין |
| 1 | R1 | אימות RLS חוזר (קריאה בלבד) — `node scripts/r1-verify-anon-access.mjs` | אין | לא | **הושלם** |
| 2a | R9-pre-A | RPC `gi_verify_agent_login` + כניסה עם fallback מקומי (בלי REVOKE) | נמוך (אפס סיכון לכניסה) | מאושר | **הושלם בפרודקשן** |
| 2b | R9-pre-B | הסתרת `agents.pin` מ־anon/authenticated + טעינת agents בלי pin | בינוני | מאושר | **DB בפרודקשן + קוד ב־PR** |
| 3 | R5 | הסרת ברירות מחדל `1234` / `0000` / `1990` מהקוד הפועל | נמוך–בינוני | **כן** | ממתין |
| 4 | R4 | הקשחת Edge Functions (`verify_jwt` / secret / בדיקת actor) | בינוני | **כן** | ממתין |
| 5 | R2 | תכנון + מעבר הדרגתי ל־Supabase Auth + RLS לפי `app_metadata` | **גבוה** | **כן** (תכנון נפרד) | ממתין |
| 6 | R3 | נעילת Storage `gi-customer-files` + `gi_simulator_saves` | גבוה בלי Auth | אחרי R2 | ממתין |
| 7 | R6–R8 | ביצועים: select צר, איחוד sync, hydrate on-demand | נמוך–בינוני | כן | ממתין |
| 8 | R10–R14 | ארכיטקטורה ארוכת טווח | משתנה | כן | עתידי |

---

## פריט קריטי ראשון מומלץ (אחרי אישור)

### R9-pre — בשני שלבים (אפס סיכון לכניסה)

**R9-pre-A (עכשיו):**
1. להריץ בפרודקשן את [`supabase-gi-verify-agent-login.sql`](../supabase-gi-verify-agent-login.sql) (SQL Editor).
2. בקוד: `verifyAgentPinForLogin` קורא ל־RPC; אם RPC חסר/נכשל טכנית — נשאר מסלול PIN הישן.
3. **לא** מסתירים עמודת `pin` בשלב זה.

**R9-pre-B (אחרי ש־2a הוכח בפרודקשן):**
1. הרצת [`supabase-gi-hide-agent-pins.sql`](../supabase-gi-hide-agent-pins.sql): `REVOKE SELECT` ברמת טבלה + `GRANT SELECT` לעמודות בלי `pin`.
2. בקוד: `AGENT_PUBLIC_COLUMNS` (בלי pin), כניסה דרך RPC בלבד (ללא ברירת מחדל `0000`), ו־agentsShadow בלי pin.
3. עריכת משתמש: PIN ריק = לא לשנות את ה־PIN בשרת.

---

## טיוטות SQL (לא להריץ ללא אישור)

הקבצים הבאים הם **טיוטות תיעוד בלבד** ולא חלק מ־migration אוטומטי:

- [`sql-drafts/R9_hide_agent_pins.DRAFT.sql`](sql-drafts/R9_hide_agent_pins.DRAFT.sql) — שלד בלבד; מסומן DRAFT.

---

## מה לא לעשות עכשיו

1. לא להפעיל `ENABLE ROW LEVEL SECURITY` + policy מצמצמת על `customers`/`agents` בלי Auth — תשבור את כל הלקוחות.
2. לא Refactor של `app.js` לצורך “סדר”.
3. לא לשנות UI/CSS/RTL.
4. לא להחזיר localStorage כמקור אמת לליבת CRM.
5. לא לשנות APIs קיימים בלי אישור.

---

## הגדרת “סיום” לשלב הנוכחי (Audit)

1. דו״ח ארכיטקטורה מלא — `CRM_ARCHITECTURE_AUDIT.md`
2. R1 מאומת מול Production — ממצאים בדו״ח + סקריפט חוזר
3. מפת תיקונים מדורגת — מסמך זה
4. **עצירה** — ממתין לבחירת פריט קריטי אחד (מומלץ: תכנון R9-pre / R2) ואישור מפורש לפני כל שינוי DB/קוד אבטחה

### סטטוס todo של התוכנית

| Todo | סטטוס |
|------|--------|
| המתנה לאישור לפני שינוי קוד/RLS | הושלם — המשתמש ביקש ליישם את תוכנית ה־Audit |
| R1 אימות RLS ב־Production | הושלם — ממצאים בדו״ח + `scripts/r1-verify-anon-access.mjs` |
| יישום תיקונים לפי עדיפות | **R9-pre-A בקוד** (RPC + fallback). ממתין להרצת SQL בפרודקשן. R9-pre-B / RLS עדיין חסומים |
