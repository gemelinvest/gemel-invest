# ספר הפעלה — חיזוק אבטחה לקראת ביקורת סייבר

**מסמך:** מדריך צעד-אחר-צעד למיזוג והפעלה של שלבי האבטחה.
**גרסה:** 1.0  **תאריך:** 2026-10-02
**למי:** בעל המערכת (מבצע המיזוג והפעלת ה-SQL ב-Supabase).
**מה הסוכן עושה:** אתה מזג ומפעיל לפי הסדר. אני (הסוכן) יודע מה לעשות עם הדוח שתשלח, ומכין את השלב הבא.

---

## כללים
- **מזג לפי הסדר** — ה-PR-ים תלויים זה בזה.
- **אחרי כל מיזוג — הפעל את ה-SQL המצוין** ב-Supabase Studio → SQL Editor (העתק את תוכן הקובץ מהענף `main` שזה עתה מוזג).
- **אחרי כל הפעלה — בדוק כניסה רגילה** (נציג + מנהל) שעובדת.
- **אם משהו משתבש — יש כפתור חירום** בכל שלב (מצוין למטה). אין צורך להתקשר אלי.

---

## שלב 1 — PR #397 (תיעוד רגולטורי + security headers)

| | |
|---|---|
| **PR** | https://github.com/gemelinvest/gemel-invest/pull/397 |
| **פעולה** | לחץ **Merge pull request** |
| **SQL להפעלה** | **אין** — רק קוד + מסמכים, נכנס ל-`main` מייד |
| **בדיקה** | פתח את ה-CRM בדפדפן → וודא שהמסך נטען כרגיל |
| **כפתור חירום** | לא נדרש (אין שינוי התנהגות) |
| **מה לשלוח לי** | רק אישור "מוזג 397" |

---

## שלב 2 — PR #398 (חסימת brute-force על כניסה)

| | |
|---|---|
| **PR** | https://github.com/gemelinvest/gemel-invest/pull/398 |
| **תנאי** | **שלב 1 (#397) חייב להיות ממוזג קודם** (יוצר את טבלת `gi_security_settings`) |
| **פעולה** | לחץ **Merge pull request** |
| **SQL להפעלה** | העתק את כל תוכן [`supabase-gi-login-bruteforce-protection.sql`](../supabase-gi-login-bruteforce-protection.sql) מהענף `main` → הדבק ב-SQL Editor → **Run** |
| **בדיקה** | 1) כניסת נציג רגיל עם PIN נכון — עובדת. 2) כניסת נציג עם PIN שגוי 10 פעמים → מקבל הודעת נעילה "נסה שוב בעוד 15 דקות" |
| **כפתור חירום** | ב-SQL Editor הרץ: `update public.gi_security_settings set value='false' where key='login_bruteforce_enabled';` — מכבה את ההגנה מייד, הכניסה חוזרת לקדם |
| **מה לשלוח לי** | אישור "מוזג 398 + הפעלתי SQL + כניסה רגילה עובדת" |

---

## שלב 3 — PR #399 (מדידת קצב כתיבות זמנית)

| | |
|---|---|
| **PR** | https://github.com/gemelinvest/gemel-invest/pull/399 |
| **תנאי** | **שלב 1 (#397) חייב להיות ממוזג** |
| **פעולה** | לחץ **Merge pull request** |
| **SQL להפעלה** | העתק את כל תוכן [`supabase-gi-write-meter.sql`](../supabase-gi-write-meter.sql) מהענף `main` → SQL Editor → **Run** |
| **מתי לחכות** | **3–5 ימים של פעילות רגילה** (כדי שהמונה יתפוס את השיא האמיתי — ייבוא לקוחות, עריכה המונית, סגירת עסקאות יומית). |
| **בדיקה** | אחרי יומיים: `select count(*) from public.gi_write_meter;` — מספר גדל (מצביע שהמונה סופר) |
| **כפתור חירום** | `update public.gi_security_settings set value='false' where key='write_meter_enabled';` — מפסיק מדידה מייד |
| **מה לשלוח לי** | **ראה שלב 3א למטה — זה הדוח החשוב** |

### שלב 3א — הדוח שעליך לשלוח לי (אחרי 3–5 ימים)

ב-SQL Editor הרץ את השאילתה הבאה והעתק אלי את כל התוצאה (כל השורות):

```sql
select * from public.gi_write_meter_report();
```

**מה שתקבל:** טבלה עם עמודות: `event_type`, `ip`, `agent_id`, `agent_name`, `peak_per_minute`, `total_events`, `first_seen`, `last_seen`.

**מה אני אעשה עם זה:** אני אקח את הערך הגבוה ביותר ב-`peak_per_minute` (השיא הרגיל), אכפיל אותו ב-5 עד 10, וזה יהיה הסף לשלב A4 (חסימת כתיבות המונית). אז אני אכין את A4 ונמשיך.

### שלב 3ב — הסרת המדידה (אופציונלי, אחרי שליחת הדוח)

אחרי ששלחת לי את הדוח, אם תרצה להסיר את המונה לחלוטין — הרץ ב-SQL Editor:

```sql
drop trigger if exists gi_write_meter_customers on public.customers;
drop function if exists public.gi_write_meter_record();
drop function if exists public.gi_write_meter_report();
drop table if exists public.gi_write_meter;
delete from public.gi_security_settings where key like 'write_meter_%';
```

(המונה גם מכבה את עצמו אוטומטית תוך 7 ימים, כך שזה אופציונלי.)

---

## מה קורה אחרי שלב 3

אחרי שתשלח לי את תוצאת `gi_write_meter_report()`, אני:
1. מחשב את הסף ל-A4 (השיא × 5–10).
2. בונה את PR של A4 (חסימת כתיבות המונית עם kill switch).
3. שולח לך הוראת הפעלה נוספת (כמו שלב 2/3 פה).

**בינתיים** (בזמן ההמתנה לדוח) אפשר להמשיך ל-A5 (CSP report-only + סריקת רכיבים) — אפס סיכוי, לא תלוי במדידה. הודע לי אם להכין גם את A5.

---

## סיכום — רשימת תיבת לבדיקה

- [ ] שלב 1: מזג #397 → אישור לי
- [ ] שלב 2: מזג #398 → הפעל SQL → בדוק כניסה → אישור לי
- [ ] שלב 3: מזג #399 → הפעל SQL → חכה 3–5 ימים
- [ ] שלב 3א: הרץ `select * from public.gi_write_meter_report();` → שלח לי את כל התוצאה
- [ ] (אופציונלי) שלב 3ב: הסר מונה

**אני אדע מה לעשות בכל שלב לפי מה שתשלח.**
