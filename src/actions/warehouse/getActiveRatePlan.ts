import { action } from '@uibakery/data';

/** Rate plan in effect today (shipments created now use shipped_date = today). */
function getActiveRatePlan() {
  return action('getActiveRatePlan', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, effective_date, base_kits, base_price_usd, tier_kits, tier_price_usd
      FROM warehouse_shipping_rate_plans
      WHERE effective_date <= CURRENT_DATE
      ORDER BY effective_date DESC
      LIMIT 1
    `,
  });
}

export default getActiveRatePlan;
