# Walkthrough — F1.2 select צר

טעינת רשימת לידים שולפת רק את העמודות ש־`mapCampaignLeadFromDb` קורא (`CAMPAIGN_LEAD_COLUMNS`, בתוספת שדות לקוח אחרי probe).

מיזוג קונפליקט לפני שמירה מושך רק מזהים dirty + תיקים פתוחים, עם עמודות רזות + `payload` — לא `select("*")` של כל הארגון. שורות חדשות ממשיכות להגיע דרך LiveRefresh.

לא שינינו כניסה, דלתא (`loadSheetsDelta`), או UI. בדיקה: סנכרון + כניסה.
