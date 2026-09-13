# Walkthrough — Pא נעילת מייל מכירות לפי פעולה

הכרון נשאר כבוי (#208). הפונקציה **לא** ננעלת ב־`verify_jwt` גלובלי.

- `send-slot` רק עם הסוד `GI_DAILY_SALES_MAIL_CRON_SECRET` (כותרת `x-gi-mail-cron-secret`).
- מסך ההגדרות (`status` / שליחה ידנית / Outlook) רק אחרי זיהוי מנהל: PIN דרך `gi_verify_agent_login` אם יש PIN בזיכרון הסשן; אחרת התאמת id+שם מול טבלת `agents`.
- כניסה ל־CRM לא השתנתה.

לפני החזרת השעון: אותה מחרוזת סוד ב־GitHub Actions וב־Supabase Function secrets.

בדיקה: סנכרון + כניסה. במסך המייל — סטטוס / שלח עכשיו. בלי הסוד, `send-slot` חייב להיכשל.
