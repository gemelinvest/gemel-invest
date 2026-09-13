# F0 — בסיס מדידת ביצועים (מונים בלבד)

**סטטוס:** יישום מדידה. **אין שינוי לוגיקה, כניסה, RLS, או ציור.**  
**כפוף ל:** [`CRM_SECURITY_PROGRAM.md`](CRM_SECURITY_PROGRAM.md)

## מה נוסף ב־`app.js`

מונים שקטים ב־`GiPerf`. אחרי כניסה בקונסול:

```js
giPerfResetCounts()
// …כניסה / שמירה / קליק על אותו תפריט…
giPerfCounts()
giPerfTimers()
giPerfReport()
```

| מונה | משמעות |
|------|---------|
| `goView` | כל מעבר מסך |
| `goView:alreadyOnView` | קליק על המסך שכבר פתוח → `renderActiveView` |
| `render:customers` / `proposals` / `dashboard` / `opsDashboard` / `elementaryDashboard` | ציור מלא של המסך |
| `render:dashboardSchedule` | תור רינדור דשבורד אחרי כניסה |
| `render:activeView` | LiveRefresh צובע את המסך הגלוי |
| `timer:LiveRefresh.tick` | כל יקיצת טיימר (גם אם `shouldRun` דוחה) |

`giPerfTimers()` מציג טיימרים שנרשמו ב־`start()` ואת `runsWhenHidden` (כולם `false` — הטיק בודק `document.hidden` בעצמו).

## איך מצלמים בסיס חי (אחרי דיפלוי)

1. Hard-refresh, `giPerfResetCounts()`.
2. כניסת מנהל עד דשבורד שמיש → `giPerfCounts()` + `giPerfReport()`.
3. `giPerfResetCounts()`, שמירת תיק לקוח → שוב `giPerfCounts()`.
4. `giPerfResetCounts()`, קליק חוזר על אותו פריט תפריט → צפוי `goView:alreadyOnView` ≥ 1.
5. חזרה על 2–4 עם נציג (לא מנהל).

המספרים האלה הם קו הבסיס ל־F1.0. F1.0 מצמצם fan-out של רשימות נסתרות; צילום חי נשאר אופציונלי.

## מה במכוון לא נגענו

- סדר קריאות `render()` / תנאי `shouldRun`
- PIN / RPC / עמודות agents
- קצב הטיימרים
- UI / CSS
