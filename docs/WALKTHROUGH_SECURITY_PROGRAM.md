# Walkthrough — תוכנית אבטחה מדורגת

מסמך תכנון בלבד. אין שינוי התנהגות CRM, אין SQL של נעילה, אין deploy.

## מה נוסף
- [`docs/CRM_SECURITY_PROGRAM.md`](CRM_SECURITY_PROGRAM.md) — תוכנית מלאה: מצב חי ב־Production, מודל איום, מטריצת תפקידים, פאזות עם שערי עצירה, rollback, החלטות נדרשות.
- [`docs/CRM_REMEDIATION_ROADMAP.md`](CRM_REMEDIATION_ROADMAP.md) — עודכן לתוכנית הזו. R9-pre-A/B מסומנים כהושלמו.

## למה זה לא “נתחיל RLS”
RLS כבר דלוק. ה־policies פתוחות. 14 משתמשים פעילים בלי Auth (כולל כל התפעול). חיתוך עכשיו ישבור כניסה/רשימות.

## הצעד הבא ליישום (רק אחרי אישור)
Pא: הקשחת `gi-daily-sales-mail` לפי action, בלי `verify_jwt` גלובלי.
