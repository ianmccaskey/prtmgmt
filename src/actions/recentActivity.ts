import { action } from '@uibakery/data';

export function getRecentActivity() {
  return action('getRecentActivity', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT * FROM (
        SELECT
          'order' AS record_type,
          so.id AS record_id,
          so.order_number AS reference,
          c.full_name AS customer_name,
          so.status,
          so.total_usd AS amount_usd,
          so.order_date::timestamptz AS event_at
        FROM sales_orders so
        JOIN customers c ON c.id = so.customer_id
        UNION ALL
        SELECT
          'shipment_out' AS record_type,
          sout.id AS record_id,
          so.order_number AS reference,
          c.full_name AS customer_name,
          sout.status,
          sout.internal_shipping_cost_usd AS amount_usd,
          sout.shipped_date::timestamptz AS event_at
        FROM shipments_outbound sout
        JOIN sales_orders so ON so.id = sout.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        WHERE sout.shipped_date IS NOT NULL
        UNION ALL
        SELECT
          'shipment_in' AS record_type,
          si.id AS record_id,
          si.reference_number AS reference,
          f.name AS customer_name,
          si.status,
          si.declared_value AS amount_usd,
          COALESCE(si.arrival_date::timestamptz, NOW()) AS event_at
        FROM shipments_inbound si
        JOIN factories f ON f.id = si.factory_id
      ) combined
      WHERE event_at IS NOT NULL
      ORDER BY event_at DESC
      LIMIT 10
    `,
  });
}

export default getRecentActivity;
