import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(fs.readFileSync(path.join(root, "content.json"), "utf8"));
const raw = fs.readFileSync(path.join(root, "content.json"), "utf8");

const required = [
  "תחרות המכירות הגדולה יוצאת לדרך!",
  "01.11.2026",
  "31.12.2026",
  "01.11.2026 – 31.12.2026",
  "חודשיים של ביצועים. יעדים. פרסים.",
  "מכירות פרט (סיכונים)",
  "יעד ראשון",
  "7,500 ₪",
  "Sony PlayStation 5",
  "סט נינג'ה",
  "מצלמה",
  "קיימת אופציה להמרה לחצי פרמיה מהסך הכולל של מכירות כלל ופניקס.",
  "יעד שני",
  "9,000 ₪",
  "iPhone 18 Pro Max",
  "Samsung Galaxy S26",
  "מכירות פנסיוני ופיננסים",
  "160,000 ₪ + 3 מיליון",
  "180,000 ₪ + 4 מיליון",
  "מכירות אלמנטרי",
  "500,000 ₪",
  "650,000 ₪",
  "הפרמיות הינן במונחי נטו בלבד.",
  "במכירות פרט מינימום 60% מהתפוקה כלל ופניקס.",
  "שחלופים לא נספרים ליעד.",
  "ביטולים ייספרו לחישוב נטו ב-3 חודשים לאחר סיום המבצע.",
  "עכשיו הזמן לתת את הביצועים שלכם!",
  "מכוונים גבוה. מוכרים יותר. זוכים בגדול!",
];

const missing = required.filter((line) => !raw.includes(line));
if (missing.length) {
  console.error(missing.join("\n"));
  throw new Error("חסרים טקסטים מהבריף");
}

function joined(lines) {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

let cursor = 0;
for (const scene of content.scenes) {
  if (Math.abs(scene.start - cursor) > 0.001) {
    throw new Error(`פער בתזמון הסצנה ${scene.id}`);
  }
  cursor = scene.start + scene.duration;
  if (scene.titleLines) {
    if (joined(scene.titleLines) !== scene.title) throw new Error(`שורות לא תואמות: ${scene.id}`);
  }
  if (scene.subtitleLines) {
    if (joined(scene.subtitleLines) !== scene.subtitle) throw new Error(`כתוביות לא תואמות: ${scene.id}`);
  }
  for (const segment of scene.segments || []) {
    if (segment.extraNumber) {
      const built = `${segment.amount} + ${segment.extraNumber} ${segment.extraWord}`;
      if (built !== segment.amountText) throw new Error(`יעד לא תואם: ${built}`);
    } else if (segment.amountText && segment.amountText !== segment.amount) {
      throw new Error(`סכום לא תואם: ${segment.amountText}`);
    }
  }
}
if (Math.abs(cursor - content.duration) > 0.001) {
  throw new Error(`משך הסרטון ${cursor} לא תואם duration`);
}

for (const prize of Object.values(content.prizes)) {
  if (joined(prize.lines) !== prize.name) throw new Error(`שם פרס לא תואם: ${prize.name}`);
}

const order = ["open", "dates", "personal", "pension", "elementary", "terms", "close"];
if (content.scenes.map((scene) => scene.id).join(",") !== order.join(",")) {
  throw new Error("סדר הסצנות השתנה");
}

console.log("copy ok");
