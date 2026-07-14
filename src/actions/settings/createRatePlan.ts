import { action } from '@uibakery/data';
function createRatePlan() {
  return action('createRatePlan', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO warehouse_shipping_rate_plans (
        effective_date, base_kits, base_price_usd, tier_kits, tier_price_usd, notes, created_at, created_by_user_id
      ) VALUES (
        {{params.effective_date}}::date, {{params.base_kits}}, {{params.base_price_usd}},
        {{params.tier_kits}}, {{params.tier_price_usd}}, {{params.notes}}, NOW(), {{params.user_id}}
      ) RETURNING id
    `,
  });
}
export default createRatePlan;
