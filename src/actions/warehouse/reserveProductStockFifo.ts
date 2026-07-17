import { action } from '@uibakery/data';

/**
 * Reserve up to {{params.quantity}} kits of a product for an order, FIFO by
 * batch manufacture date, passed-QC batches only. Set-based: the window sum
 * walks rows oldest-first and each row takes what's left. Every reservation
 * is recorded in the inventory_reservations ledger so later release/consume
 * touches exactly this order's rows.
 *
 * The UPDATE re-checks `reserved + take <= on_hand` at lock time, so a
 * concurrent reservation that landed between snapshot and update makes this
 * row a no-op (slight under-reservation = backorder) instead of
 * over-reserving. Reserves min(quantity, total available).
 *
 * params.warehouse_id ('' = all warehouses) restricts candidates to the
 * order's preferred fulfillment warehouse when one is set.
 */
function reserveProductStockFifo() {
  return action('reserveProductStockFifo', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH candidates AS (
        SELECT i.id,
          (i.quantity_on_hand - i.quantity_reserved) AS avail,
          SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved))
            OVER (ORDER BY pb.manufacture_date ASC NULLS LAST, i.id ASC) AS running
        FROM inventory i
        JOIN product_batches pb ON pb.id = i.batch_id
        WHERE i.product_id = {{params.product_id}}::bigint
          AND pb.qc_status = 'passed'
          AND (i.quantity_on_hand - i.quantity_reserved) > 0
          AND (COALESCE({{params.warehouse_id}}, '') = '' OR i.warehouse_id::text = {{params.warehouse_id}})
      ),
      calc AS (
        SELECT id,
          GREATEST(0, LEAST(avail, {{params.quantity}}::int - (running - avail))) AS take
        FROM candidates
      ),
      upd AS (
        UPDATE inventory i
        SET quantity_reserved = i.quantity_reserved + c.take
        FROM calc c
        WHERE c.id = i.id AND c.take > 0
          AND i.quantity_reserved + c.take <= i.quantity_on_hand
        RETURNING i.id AS inventory_id, i.product_id, c.take
      )
      INSERT INTO inventory_reservations (sales_order_id, product_id, inventory_id, quantity)
      SELECT {{params.order_id}}::bigint, product_id, inventory_id, take FROM upd
      RETURNING inventory_id, quantity AS reserved_qty
    `,
  });
}

export default reserveProductStockFifo;
