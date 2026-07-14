import { action } from '@uibakery/data';
function listRatePlans() {
  return action('listRatePlans', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        rp.id, rp.effective_date, rp.base_kits, rp.base_price_usd,
        rp.tier_kits, rp.tier_price_usd, rp.notes, rp.created_at,
        up.display_name AS created_by_name
      FROM warehouse_shipping_rate_plans rp
      LEFT JOIN user_profiles up ON up.user_id = rp.created_by_user_id
      ORDER BY rp.effective_date DESC
    `,
  });
}
export default listRatePlans;
