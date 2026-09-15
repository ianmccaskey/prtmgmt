/**
 * Customer-facing order quote text for pasting into chat (Telegram etc.):
 *
 *   4x T30: $340
 *   2x R20: $280
 *   Total: $600
 *   We accept USDC or USDT on ethereum and solana networks. ...
 *
 * Whole-dollar amounts print without cents (matching how quotes read in
 * chat); anything else keeps 2 decimals. Discount/shipping lines appear
 * only when non-zero.
 */
const usd = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

export const PAYMENT_BLURB =
  'We accept USDC or USDT on ethereum and solana networks. Also BTC with a $5 conversion fee. Please let me know what works for you :)';

export function buildOrderQuoteText(
  items: { sku: string; quantity: number; lineTotal: number }[],
  discount: number,
  shipping: number,
  total: number,
): string {
  const lines = items.map(i => `${i.quantity}x ${i.sku}: ${usd(i.lineTotal)}`);
  if (discount > 0) lines.push(`Discount: -${usd(discount)}`);
  if (shipping > 0) lines.push(`Shipping: ${usd(shipping)}`);
  lines.push(`Total: ${usd(total)}`);
  lines.push(PAYMENT_BLURB);
  return lines.join('\n');
}

export default buildOrderQuoteText;
