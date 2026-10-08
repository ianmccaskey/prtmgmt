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
        -- Rate-plan earnings PLUS expedited shipping fees routed to the
        -- warehouse that ships the order (first warehouse-origin shipment).
        -- Mirrors getVendorBalance / executeSettlementAtomic.
        SELECT u.origin_warehouse_id, SUM(u.commission_earned) AS commission_earned, SUM(u.shipments_count) AS shipments_count
        FROM (
          SELECT
            so.origin_warehouse_id,
            SUM(so.internal_shipping_cost_usd) AS commission_earned,
            COUNT(*) AS shipments_count
          FROM shipments_outbound so
          WHERE so.origin = 'warehouse' AND so.internal_shipping_cost_usd IS NOT NULL
          GROUP BY so.origin_warehouse_id
          UNION ALL
          SELECT f.wid, SUM(f.fee), 0 FROM (
            SELECT DISTINCT ON (so3.id) sh3.origin_warehouse_id AS wid, so3.customer_shipping_charge_usd AS fee
            FROM sales_orders so3
            JOIN shipments_outbound sh3 ON sh3.sales_order_id = so3.id AND sh3.origin = 'warehouse'
            WHERE so3.shipping_fee_recipient = 'warehouse'
              AND COALESCE(so3.customer_shipping_charge_usd, 0) > 0
              AND so3.status NOT IN ('cancelled', 'quote')
            ORDER BY so3.id, sh3.id) f GROUP BY f.wid
        ) u GROUP BY u.origin_warehouse_id
      ) shipments ON shipments.origin_warehouse_id = w.id
      LEFT JOIN (
        SELECT warehouse_id, SUM(amount_usd) AS paid_total
        FROM commission_payments
        WHERE payee_type = 'warehouse'
        GROUP BY warehouse_id
      ) payments ON payments.warehouse_id = w.id
      WHERE (COALESCE({{params.warehouse_id}}, '') = '' OR w.id::text = {{params.warehouse_id}})
      ORDER BY balance_owed_usd DESC
    `,
  });
}

export default listWarehouseBalances;
