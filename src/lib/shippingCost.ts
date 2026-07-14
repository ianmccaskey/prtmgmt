export type RatePlan = {
  id: number;
  effective_date: string;
  base_kits: number;
  base_price_usd: number;
  tier_kits: number;
  tier_price_usd: number;
};

/**
 * Internal warehouse shipping cost for a shipment of `kits`:
 * base_price covers the first base_kits; each additional tier_kits block
 * (rounded up) adds tier_price. E.g. defaults 6/$18 + 6/$8:
 * 6 kits = $18, 7 = $26, 12 = $26, 13 = $34.
 */
export function calcShippingCost(plan: RatePlan, kits: number): number {
  if (!plan || kits <= 0) return 0;
  const base = Number(plan.base_price_usd);
  const extra = Math.max(0, kits - Number(plan.base_kits));
  const tiers = Number(plan.tier_kits) > 0 ? Math.ceil(extra / Number(plan.tier_kits)) : 0;
  return base + tiers * Number(plan.tier_price_usd);
}
