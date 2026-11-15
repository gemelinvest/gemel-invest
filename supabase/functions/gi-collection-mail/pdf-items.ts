// Text positions from a collection PDF. A failed parse returns no rows
// and the caller keeps the message in the hold queue.

import { getDocumentProxy } from "npm:unpdf@1.4.0";

type PdfItem = { x: number; y: number; text: string };

export async function pdfTextItems(bytes: Uint8Array){
  const items: PdfItem[] = [];
  const texts: string[] = [];
  const pdf = await getDocumentProxy(bytes);
  const pages = Math.min(Number(pdf.numPages) || 0, 6);
  for(let pageNumber = 1; pageNumber <= pages; pageNumber += 1){
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = Array.isArray(content?.items) ? content.items : [];
    rows.forEach((item: { str?: unknown; transform?: number[] }) => {
      const value = String(item?.str == null ? "" : item.str).replace(/\s+/g, " ").trim();
      if(!value) return;
      const transform = Array.isArray(item.transform) ? item.transform : [];
      items.push({
        x: Number(transform[4]) || 0,
        y: (Number(transform[5]) || 0) + pageNumber * 2000,
        text: value
      });
      texts.push(value);
    });
  }
  try { await pdf.destroy(); } catch(_e) {}
  return { items, text: texts.join(" ") };
}
