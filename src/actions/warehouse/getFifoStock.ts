import { action } from '@uibakery/data';

/**
 * FIFO allocation candidates for every warehouse-sourced product on an order:
 * passed-QC inventory rows ordered oldest-batch-first, with how much of each
 * row this order has already reserved (its ledger rows) — that reserved
 * amount is shippable by this order even though it's excluded from
 * quantity_available.
 */
function getFifoStock() {
  return action('getFifoStock', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        i.id AS inventory_id, i.product_id, i.batch_id, i.warehouse_id,
        i.quantity_on_hand, i.quantity_reserved,
        (i.quantity_on_hand - i.quantity_reserved) AS quantity_available,
        COALESCE(res.order_reserved, 0) AS order_reserved,
        pb.batch_number, pb.manufacture_date,
        w.name AS warehouse_name
      FROM inventory i
      JOIN product_batches pb ON pb.id = i.batch_id
      JOIN warehouses w ON w.id = i.warehouse_id
      LEFT JOIN (
        SELECT inventory_id, SUM(quantity) AS order_reserved
        FROM inventory_reservations
        WHERE sales_order_id = {{params.order_id}}::bigint
        GROUP BY inventory_id
      ) res ON res.inventory_id = i.id
      WHERE pb.qc_status = 'passed'
        AND i.quantity_on_hand > 0
        AND i.product_id IN (
          SELECT product_id FROM sales_order_items
          WHERE sales_order_id = {{params.order_id}}::bigint
            AND fulfillment_source = 'warehouse'
        )
      ORDER BY i.product_id ASC, pb.manufacture_date ASC NULLS LAST, i.id ASC
    `,
  });
}

export default getFifoStock;
