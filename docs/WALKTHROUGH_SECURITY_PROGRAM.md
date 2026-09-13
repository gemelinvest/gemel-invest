# Walkthrough — תוכנית אבטחה מדורגת

מסמך תכנון בלבד. אין שינוי התנהגות CRM, אין SQL של נעילה, אין deploy.

## מה נוסף
- [`docs/CRM_SECURITY_PROGRAM.md`](CRM_SECURITY_PROGRAM.md) — תוכנית אבטחה: מצב חי, מטריצת תפקידים, פאזות עם שערים.
- [`docs/CRM_PERFORMANCE_PROGRAM.md`](CRM_PERFORMANCE_PROGRAM.md) — נתיב מקביל שאושר: אוטומציות + המערכת + **רינדורים כפולים/מיותרים** (F0–F4, F1.0).
- [`docs/CRM_REMEDIATION_ROADMAP.md`](CRM_REMEDIATION_ROADMAP.md) — שני הנתיבים. R9-pre-A/B הושלמו.

## למה זה לא “נתחיל RLS”
RLS כבר דלוק. ה־policies פתוחות. 14 משתמשים פעילים בלי Auth (כולל כל התפעול). חיתוך עכשיו ישבור כניסה/רשימות.

## הצעד הבא ליישום (רק אחרי אישור נפרד לכל אחד)
1. Pא: הקשחת `gi-daily-sales-mail` לפי action, בלי `verify_jwt` גלובלי.
2. F0: מדידת טיימרים + `giPerf` — בלי שינוי מוצר.
