import { action } from '@uibakery/data';

export function getDashboardStats() {
  return action('getDashboardStats', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        (SELECT COUNT(*) FROM sales_orders WHERE status IN ('confirmed','in_production','partially_shipped')) AS open_orders,
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'shipped' AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)) AS shipped_this_month,
        (SELECT COALESCE(SUM(total_usd),0) FROM sales_orders WHERE status IN ('shipped','delivered') AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)) AS revenue_this_month,
        (SELECT COUNT(*) FROM shipments_inbound WHERE status IN ('freight_forwarder','in_transit')) AS inbound_in_transit,
        (SELECT COUNT(DISTINCT p.id) FROM products p
          JOIN inventory i ON i.product_id = p.id
          WHERE p.low_stock_threshold IS NOT NULL
          GROUP BY p.id
          HAVING SUM(i.quantity_on_hand - i.quantity_reserved) <= MAX(p.low_stock_threshold)
        ) AS low_stock_alerts,
        (SELECT COALESCE(SUM(so.total_usd - COALESCE(paid.paid_usd,0)),0)
          FROM sales_orders so
          LEFT JOIN (
            SELECT sales_order_id, SUM(amount_usd) AS paid_usd
            FROM order_payments
            WHERE verification_status = 'verified' AND direction = 'incoming'
            GROUP BY sales_order_id
          ) paid ON paid.sales_order_id = so.id
          WHERE so.payment_status IN ('unpaid','partial_paid')
        ) AS unpaid_balance_usd,
        (SELECT COUNT(*) FROM order_payments WHERE verification_status = 'pending' AND direction = 'incoming') AS unverified_payments,
        (SELECT COUNT(*) FROM order_payments WHERE issue_type IS NOT NULL) AS payments_with_issues,
        (SELECT COUNT(*) FROM refund_tasks WHERE status = 'owed') AS refunds_owed_count,
        (SELECT COALESCE(SUM(amount_usd_owed),0) FROM refund_tasks WHERE status = 'owed') AS refunds_owed_usd,
        (SELECT COUNT(*) FROM refund_tasks WHERE status = 'owed' AND due_date < CURRENT_DATE) AS overdue_refunds,
        (SELECT COUNT(*) FROM shipments_outbound WHERE issue_flag IS NOT NULL) AS outbound_issues,
        (SELECT COALESCE(SUM(internal_shipping_cost_usd),0) FROM shipments_outbound WHERE payable_status = 'owed' AND origin = 'warehouse') AS warehouse_payables_usd,
        (SELECT COUNT(DISTINCT soi.sales_order_id) FROM sales_order_items soi
          JOIN sales_orders so ON so.id = soi.sales_order_id
          WHERE soi.fulfillment_source = 'china_direct' AND so.status IN ('confirmed','in_production')
        ) AS china_direct_awaiting
    `,
  });
}

export default getDashboardStats;
