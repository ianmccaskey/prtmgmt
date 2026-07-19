import { action } from '@uibakery/data';

/**
 * Orders with warehouse-sourced lines not yet fully allocated/shipped.
 * Includes partially_shipped so remaining lines can ship in a later pass.
 * stock_available counts passed-QC batches only; fulfill_warehouses lists
 * warehouses holding sellable stock for the product.
 */
function listFulfillmentQueue() {
  return action('listFulfillmentQueue', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id AS order_id, so.order_number, so.status, so.order_date,
        so.partial_fulfillment_allowed, so.preferred_warehouse_id,
        pw.name AS preferred_warehouse_name,
        so.ship_to_name, so.ship_address_line1, so.ship_address_line2,
        so.ship_city, so.ship_state, so.ship_postal_code, so.ship_country,
        c.full_name AS customer_name,
        soi.id AS item_id, soi.product_id, soi.quantity, soi.unit_price_usd,
        soi.preferred_batch_id, pb_pref.batch_number AS preferred_batch_number,
        soi.preferred_warehouse_id AS line_preferred_warehouse_id,
        lw.name AS line_preferred_warehouse_name,
        p.sku, p.name AS product_name,
        COALESCE(alloc.allocated_qty, 0) AS allocated_qty,
        COALESCE(stock.available_qty, 0) AS stock_available,
        COALESCE(res.reserved_qty, 0) AS order_reserved_qty,
        COALESCE(stock.warehouse_names, '{}') AS fulfill_warehouses
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      JOIN sales_order_items soi ON soi.sales_order_id = so.id
      JOIN products p ON p.id = soi.product_id
      LEFT JOIN product_batches pb_pref ON pb_pref.id = soi.preferred_batch_id
      LEFT JOIN warehouses pw ON pw.id = so.preferred_warehouse_id
      LEFT JOIN warehouses lw ON lw.id = soi.preferred_warehouse_id
      LEFT JOIN (
        SELECT sales_order_item_id, SUM(quantity) AS allocated_qty
        FROM sales_order_item_allocations GROUP BY sales_order_item_id
      ) alloc ON alloc.sales_order_item_id = soi.id
      LEFT JOIN (
        SELECT ir.sales_order_id, ir.product_id, SUM(ir.quantity) AS reserved_qty
        FROM inventory_reservations ir GROUP BY ir.sales_order_id, ir.product_id
      ) res ON res.sales_order_id = so.id AND res.product_id = soi.product_id
      LEFT JOIN (
        SELECT i.product_id,
          SUM(i.quantity_on_hand - i.quantity_reserved) AS available_qty,
          ARRAY_AGG(DISTINCT w.name) FILTER (WHERE i.quantity_on_hand - i.quantity_reserved > 0) AS warehouse_names
        FROM inventory i
        JOIN warehouses w ON w.id = i.warehouse_id
        JOIN product_batches pb ON pb.id = i.batch_id AND pb.qc_status = 'passed'
        GROUP BY i.product_id
      ) stock ON stock.product_id = soi.product_id
      WHERE so.status IN ('confirmed', 'partially_shipped')
        AND soi.fulfillment_source = 'warehouse'
        AND COALESCE(alloc.allocated_qty, 0) < soi.quantity
      ORDER BY so.order_date ASC, so.id ASC, soi.id ASC
    `,
  });
}

export default listFulfillmentQueue;
