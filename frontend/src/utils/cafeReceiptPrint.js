import { toast } from "sonner";

// Exact inline stylesheet the printed KOT has always used — kept as one
// constant so every caller (the just-placed receipt, a later reprint) can
// never drift from each other.
const CAFE_RECEIPT_PRINT_STYLE =
  "*{box-sizing:border-box}@page{size:80mm auto;margin:4mm} body{font-family:'Courier New',monospace;width:72mm;font-size:12px;color:#000;font-weight:700;padding:8px}.row{display:flex;justify-content:space-between}.hr{border-top:1px dashed #000;margin:6px 0}.center{text-align:center}body, body *{color:#000 !important;-webkit-text-stroke:0.25px #000}";

// Prints the #cafe-receipt (or `elementId`) node straight to the fixed
// kitchen printer (Kitchen_Print, see electron/main.js) with no OS print
// dialog whenever running inside the Electron shell. Plain-browser
// dev/preview (no window.electronAPI) keeps the popup + window.print()
// fallback. Shared by the "just placed" receipt (Cafepos.jsx) and the KOT
// history reprint (Runningbills.jsx) so both go through the exact same
// pipeline — a reprint is guaranteed identical because it's the same code,
// not a re-implementation.
export function printCafeReceipt({ elementId = "cafe-receipt", kotNumber }) {
  const html = document.getElementById(elementId)?.innerHTML ?? "";
  const fullHtml = `<html><head><title>KOT ${kotNumber}</title><style>${CAFE_RECEIPT_PRINT_STYLE}</style></head><body>${html}</body></html>`;

  if (window.electronAPI?.printKOT) {
    window.electronAPI.printKOT(fullHtml).then((result) => {
      if (!result?.printed) {
        toast.error(`KOT print failed${result?.error ? `: ${result.error}` : ""}`);
      }
    });
    return;
  }

  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return;
  w.document.write(fullHtml);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
