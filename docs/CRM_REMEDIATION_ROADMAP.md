# מפת תיקונים מדורגת — GEMEL INVEST CRM

**מבוסס על:** [`CRM_ARCHITECTURE_AUDIT.md`](CRM_ARCHITECTURE_AUDIT.md) + אימות R1 ב־Production.  
**תוכנית האבטחה המחייבת:** [`CRM_SECURITY_PROGRAM.md`](CRM_SECURITY_PROGRAM.md)  
**נתיב ביצועים מקביל (אושר):** [`CRM_PERFORMANCE_PROGRAM.md`](CRM_PERFORMANCE_PROGRAM.md)  
**חשוב:** הפעלת policy מצמצמת על `customers` לפני זהות JWT ל־57 המשתמשים הפעילים **תשבור את ה־CRM**. RLS כבר דלוק; רוב ה־policies הן `USING (true)`.

---

## סדר ביצוע מומלץ

| עדיפות | מזהה | פעולה | סיכון שינוי | דורש אישור מפורש? | סטטוס |
|--------|------|--------|-------------|-------------------|--------|
| 0 | OPS / P0 | מחיקת שורת `__audit_probe_cust__` ב־SQL Editor (service role) | נמוך | כן (גישת service) | ממתין |
| 1 | R1 | אימות RLS חוזר (קריאה בלבד) — `node scripts/r1-verify-anon-access.mjs` | אין | לא | **הושלם** |
| 2a | R9-pre-A | RPC `gi_verify_agent_login` | נמוך | מאושר | **הושלם בפרודקשן** |
| 2b | R9-pre-B | הסתרת `agents.pin` מ־anon/authenticated | בינוני | מאושר | **הושלם בפרודקשן** (PR #201) |
| 3 | Pא / R4 | הקשחת Edge לפי פונקציה — קודם `gi-daily-sales-mail` (לא `verify_jwt` גלובלי) | בינוני | **כן** | ממתין לאישור |
| 4 | Pב / R5 | הסרת ברירות מחדל `1234` / `0000` / `1990` מהקוד הפועל | נמוך–בינוני | כן | משני — לא על הנתיב הקריטי |
| 5 | Pג | זהות: JWT אחרי PIN, בלי נעילת anon | בינוני | **כן** + החלטת רישום 14 משתמשים בלי Auth | חסום עד החלטות בסעיף 9 בתוכנית |
| 6 | Pד | מדיניות צל ל־`authenticated` לפי מטריצת תפקידים | נמוך למוצר | **כן** | אחרי שער Pג |
| 7 | Pה / R2 חיתוך | החלפת `USING (true)` טבלה־טבלה | **גבוה** | **כן** | אחרי שערי Pג+Pד |
| 8 | Pו / R3 | נעילת Storage `gi-customer-files` + `gi_simulator_saves` | גבוה בלי Pה | אחרי Pה | ממתין |
| 9a | F0 | ביצועים: מדידת טיימרים + `giPerf` (מנהל/נציג) | אין | **אושר כנתיב** — יישום F0 בנפרד | ממתין לאישור התחלה |
| 9b | F1 | אוטומציות בדפדפן: מקור sync אחד, backoff, לידים/conflict בלי `select("*")`, hydrate ל־working-set | נמוך–בינוני | אחרי F0 | מקביל ל־Pא–Pד; מוקפא ב־Pה |
| 9c | F2 | אוטומציות שרת: מייל/עוזר — התנהגות בלבד, בלי לגעת ב־auth | בינוני מקומי | כן | לא באותו PR של Pא |
| 9d | F3 | ליבת מערכת: `normalizeState`, select צר, `goView` | נמוך–בינוני | אחרי F1 | לא ב־Pה |
| 9e | F4 | מדידה מחדש + אינדקסים אחרי חיתוך RLS | נמוך | אחרי Pה | ממתין |
| 10 | R10–R14 | ארכיטקטורה ארוכת טווח (פיצול מונולית וכו') | משתנה | כן | עתידי |

---

## מה כבר נסגר

**R9-pre-A:** [`supabase-gi-verify-agent-login.sql`](../supabase-gi-verify-agent-login.sql) + `verifyAgentPinForLogin`.

**R9-pre-B:** [`supabase-gi-hide-agent-pins.sql`](../supabase-gi-hide-agent-pins.sql) + `AGENT_PUBLIC_COLUMNS`. PIN לא נשלף ב־REST; כניסה דרך RPC.

---

## למה לא “פשוט RLS” עכשיו

נמדד ב־Production (2026-09-13), פירוט בתוכנית:

- 14 משתמשים פעילים בלי `auth_user_id` — כולל **כל** נציגי התפעול.
- רק 9 פעילים עם אימייל בטבלת `agents`.
- 122 לקוחות בלי `agent_id`.
- `ops` / `opsAgent` רואים את כל הלקוחות בשרת; `elementary` / `referent` / `teamManager` אינם `agent_id = self`.
- Edge המייל היומי רץ מ־GitHub Action בלי JWT.

---

## טיוטות SQL (לא להריץ ללא אישור)

- [`sql-drafts/R9_hide_agent_pins.DRAFT.sql`](sql-drafts/R9_hide_agent_pins.DRAFT.sql) — שלד ישן; המימוש החי הוא `supabase-gi-hide-agent-pins.sql`.

אין טיוטת חיתוך `customers` במסמך זה בכוונה. SQL כזה ייווצר רק בפאזה Pד, אחרי מטריצת בדיקות.

---

## מה לא לעשות עכשיו

1. לא להחליף `USING (true)` על `customers`/`agents`/`app_meta` לפני שערי Pג+Pד.
2. לא Refactor של `app.js` לצורך “סדר”.
3. לא לשנות UI/CSS/RTL.
4. לא להחזיר localStorage כמקור אמת לליבת CRM.
5. לא `verify_jwt=true` גלובלי על Edge Functions.
6. לא לשנות APIs קיימים בלי אישור.

---

## הצעד הבא ליישום

שני אישורים נפרדים, לא אותו PR:

1. אבטחה: **Pא על `gi-daily-sales-mail` בלבד**.
2. ביצועים: **F0 מדידה בלבד** — [`CRM_PERFORMANCE_PROGRAM.md`](CRM_PERFORMANCE_PROGRAM.md).

עד אישור ההתחלה — קוראים את שתי התוכניות. אין נעילת RLS ואין שינוי טיימרים.
