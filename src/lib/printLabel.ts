/**
 * One-click label printing.
 *
 * Two paths, because Shippo's label host (deliver.goshippo.com) serves
 * NO CORS headers (verified: no Access-Control-Allow-Origin; OPTIONS
 * 403), so the browser cannot fetch those PDFs for a silent print:
 *
 *  - data: URLs (labels uploaded via Replace Label) and any
 *    CORS-permitting URL: fetched to a blob and printed from a hidden
 *    same-origin iframe — fully silent, stays on the page.
 *  - everything else (Shippo URLs): a minimal popup embedding the PDF
 *    full-viewport that calls print() once loaded — one click to the
 *    print dialog instead of open-tab-then-Ctrl+P.
 *
 * Returns false only when a popup was needed and the browser blocked it
 * (caller should fall back to opening the URL normally).
 */
export async function printLabel(url: string): Promise<boolean> {
  // Silent path: same-origin printable blob.
  try {
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      await new Promise<void>((resolve, reject) => {
        frame.onload = () => resolve();
        frame.onerror = () => reject(new Error('load failed'));
        frame.src = obj;
        document.body.appendChild(frame);
      });
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      // The frame must outlive the print dialog; clean up well after.
      setTimeout(() => { URL.revokeObjectURL(obj); frame.remove(); }, 120000);
      return true;
    }
  } catch {
    // CORS or network — fall through to the popup path.
  }

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(
    '<html><head><title>Print label</title>' +
    '<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>' +
    '</head><body>' +
    `<iframe src="${url.replace(/"/g, '&quot;')}" onload="setTimeout(function(){window.focus();window.print();},800)"></iframe>` +
    '</body></html>');
  win.document.close();
  return true;
}

export default printLabel;
