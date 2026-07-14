import { action } from '@uibakery/data';

function listWarehouseBalances() {
  return action('listWarehouseBalances', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        w.id AS warehouse_id, w.name AS warehouse_name,
        COALESCE(shipments.commission_earned, 0) AS commission_earned_usd,
        COALESCE(payments.paid_total, 0) AS paid_total_usd,
        COALESCE(shipments.commission_earned, 0) - COALESCE(payments.paid_total, 0) AS balance_owed_usd,
        COALESCE(shipments.shipments_count, 0) AS shipments_count
      FROM warehouses w
      LEFT JOIN (
        SELECT
          so.origin_warehouse_id,
          SUM(so.internal_shipping_cost_usd) AS commission_earned,
          COUNT(*) AS shipments_count
        FROM shipments_outbound so
        WHERE so.origin = 'warehouse' AND so.internal_shipping_cost_usd IS NOT NULL
        GROUP BY so.origin_warehouse_id
      ) shipments ON shipments.origin_warehouse_id = w.id
      LEFT JOIN (
        SELECT warehouse_id, SUM(amount_usd) AS paid_total
        FROM commission_payments
        WHERE payee_type = 'warehouse'
        GROUP BY warehouse_id
      ) payments ON payments.warehouse_id = w.id
      ORDER BY balance_owed_usd DESC
    `,
  });
}

export default listWarehouseBalances;
