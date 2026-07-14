import { action } from '@uibakery/data';

/** Batch allocations for every line on an order (with shipped quantities). */
export function getOrderItemAllocations() {
  return action('getOrderItemAllocations', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        a.id, a.sales_order_item_id, a.quantity, a.allocated_at,
        pb.batch_number, w.name AS warehouse_name,
        COALESCE(SUM(soi2.quantity_shipped), 0) AS quantity_shipped
      FROM sales_order_item_allocations a
      JOIN sales_order_items soi ON soi.id = a.sales_order_item_id
      JOIN product_batches pb ON pb.id = a.batch_id
      JOIN warehouses w ON w.id = a.warehouse_id
      LEFT JOIN shipments_outbound_items soi2 ON soi2.allocation_id = a.id
      WHERE soi.sales_order_id = {{params.orderId}}::bigint
      GROUP BY a.id, a.sales_order_item_id, a.quantity, a.allocated_at, pb.batch_number, w.name
      ORDER BY a.sales_order_item_id, a.allocated_at
    `,
  });
}

export default getOrderItemAllocations;
