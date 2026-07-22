import { action } from '@uibakery/data';

/**
 * Verified incoming customer payments grouped by the order's sales rep and
 * the receiving asset/network (wallet) — "what did each rep collect, into
 * which wallet". Date range filters on verified_at ('' = open-ended).
 */
function listRepWalletReceipts() {
  return action('listRepWalletReceipts', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.sales_rep_user_profile_id AS rep_id,
        COALESCE(up.display_name, 'Unassigned') AS display_name,
        op.asset, op.network,
        SUM(op.amount_usd)::numeric(12,2) AS total_usd,
        COUNT(*)::int AS payments_count
      FROM order_payments op
      JOIN sales_orders so ON so.id = op.sales_order_id
      LEFT JOIN user_profiles up ON up.id = so.sales_rep_user_profile_id
      WHERE op.direction = 'incoming' AND op.verification_status = 'verified'
        AND (COALESCE({{params.date_from}}, '') = '' OR op.verified_at >= NULLIF({{params.date_from}}, '')::date)
        AND (COALESCE({{params.date_to}}, '') = '' OR op.verified_at < (NULLIF({{params.date_to}}, '')::date + 1))
      GROUP BY so.sales_rep_user_profile_id, up.display_name, op.asset, op.network
      ORDER BY display_name, op.asset, op.network
    `,
  });
}

export default listRepWalletReceipts;
