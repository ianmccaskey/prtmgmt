/**
 * One-click label printing.
 *
 * Shippo's label host (deliver.goshippo.com) serves NO CORS headers
 * (verified: no Access-Control-Allow-Origin; OPTIONS 403), so the browser
 * cannot fetch those files for a silent print. Three paths:
 *
 *  - data: URLs (labels uploaded via Replace Label) and any CORS-permitting
 *    URL: fetched to a blob and printed from a hidden same-origin iframe —
 *    fully silent, stays on the page.
 *  - cross-origin IMAGE labels (Shippo labels are purchased as PNG for
 *    exactly this reason): a minimal popup with an <img> that calls print()
 *    once loaded. Cross-origin images render in print output, so this is
 *    one click to the print dialog.
 *  - cross-origin PDF labels (legacy, purchased before the PNG switch):
 *    there is NO working auto-print. Chrome's PDF plugin in an embedded
 *    frame isn't composited into the opener's print() — it prints as a
 *    black box — and a popup navigated to the PDF is cross-origin, so its
 *    print() is unreachable. The popup opens Chrome's PDF viewer directly
 *    and the caller tells the user to press its print button ('manual').
 */
export type PrintLabelResult = 'printed' | 'manual' | 'blocked';

/** True when the URL's path names an image file (query string ignored). */
function isImageUrl(url: string): boolean {
  try {
    return /\.(png|jpe?g|gif|webp)$/i.test(new URL(url, window.location.href).pathname);
  } catch {
    return false;
  }
}

/**
 * Print CSS shared by every image-label document: @page declares 4x6
 * media so the print dialog defaults to label stock instead of letter
 * with margins (labels are 4x6 — Shippo PNGs and uploaded label images
 * alike), and the image fills that page exactly.
 */
const IMAGE_PRINT_STYLE =
  '<style>@page{size:4in 6in;margin:0}html,body{margin:0}img{width:4in;height:auto;display:block}</style>';

export async function printLabel(url: string): Promise<PrintLabelResult> {
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
      // An image blob gets the 4x6 print document via srcdoc (a bare image
      // document can't carry @page and would print letter-sized); a PDF
      // blob is loaded directly — it declares its own page size.
      const isImage = blob.type.startsWith('image/');
      await new Promise<void>((resolve, reject) => {
        frame.onload = () => resolve();
        frame.onerror = () => reject(new Error('load failed'));
        if (isImage) {
          frame.srcdoc = `<html><head>${IMAGE_PRINT_STYLE}</head><body><img src="${obj}"></body></html>`;
        } else {
          frame.src = obj;
        }
        document.body.appendChild(frame);
      });
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      // The frame must outlive the print dialog; clean up well after.
      setTimeout(() => { URL.revokeObjectURL(obj); frame.remove(); }, 120000);
      return 'printed';
    }
  } catch {
    // CORS or network — fall through to the popup paths.
  }

  const escaped = url.replace(/"/g, '&quot;');

  if (isImageUrl(url)) {
    const win = window.open('', '_blank');
    if (!win) return 'blocked';
    win.document.write(
      '<html><head><title>Print label</title>' +
      IMAGE_PRINT_STYLE +
      '</head><body>' +
      `<p id="err" style="display:none;font-family:sans-serif;padding:12px">Label failed to load — close this window and use Open label.</p>` +
      `<img src="${escaped}"` +
      ' onload="setTimeout(function(){window.focus();window.print();},150)"' +
      ' onerror="this.style.display=\'none\';document.getElementById(\'err\').style.display=\'block\'">' +
      '</body></html>');
    win.document.close();
    return 'printed';
  }

  // Legacy cross-origin PDF: open the browser's own PDF viewer. Not
  // window.open(url, '_blank', 'noopener') — with noopener Chrome returns
  // null even on SUCCESS, which would misreport every open as blocked.
  // Open blank (null here really means blocked), sever opener, navigate.
  const win = window.open('', '_blank');
  if (!win) return 'blocked';
  win.opener = null;
  win.location.href = url;
  return 'manual';
}

export default printLabel;
