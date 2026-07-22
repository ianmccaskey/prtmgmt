import { action } from '@uibakery/data';

/**
 * Vendor ledger rollup: verified collections (incoming minus refunds) less
 * rep commissions earned (same 10% non-cancelled/non-quote basis as
 * listRepBalances) and warehouse shipping earned (same basis as
 * listWarehouseBalances) = the vendor's share; minus vendor payments
 * recorded = balance owed to the vendor.
 */
function getVendorBalance() {
  return action('getVendorBalance', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        COALESCE(pay.collected, 0)::numeric(14,2) AS collected_usd,
        COALESCE(rep.earned, 0)::numeric(14,2) AS rep_commissions_usd,
        COALESCE(wh.earned, 0)::numeric(14,2) AS warehouse_earned_usd,
        (COALESCE(pay.collected, 0) - COALESCE(rep.earned, 0) - COALESCE(wh.earned, 0))::numeric(14,2) AS vendor_share_usd,
        COALESCE(vp.paid, 0)::numeric(14,2) AS vendor_paid_usd,
        (COALESCE(pay.collected, 0) - COALESCE(rep.earned, 0) - COALESCE(wh.earned, 0) - COALESCE(vp.paid, 0))::numeric(14,2) AS balance_owed_usd
      FROM (SELECT 1) x
      LEFT JOIN (
        SELECT SUM(CASE WHEN direction = 'refund' THEN -amount_usd ELSE amount_usd END) AS collected
        FROM order_payments WHERE verification_status = 'verified'
      ) pay ON true
      LEFT JOIN (
        SELECT SUM(so.total_usd * 0.10) AS earned
        FROM sales_orders so
        WHERE so.sales_rep_user_profile_id IS NOT NULL AND so.status NOT IN ('cancelled', 'quote')
      ) rep ON true
      LEFT JOIN (
        SELECT SUM(internal_shipping_cost_usd) AS earned
        FROM shipments_outbound
        WHERE origin = 'warehouse' AND internal_shipping_cost_usd IS NOT NULL
      ) wh ON true
      LEFT JOIN (
        SELECT SUM(amount_usd) AS paid FROM commission_payments WHERE payee_type = 'vendor'
      ) vp ON true
    `,
  });
}

export default getVendorBalance;
