import { action } from '@uibakery/data';

/**
 * Reserve up to {{params.quantity}} kits of a product across inventory rows,
 * FIFO by batch manufacture date, passed-QC batches only. Entirely set-based:
 * the window sum walks rows oldest-first and each row takes what's left.
 * Reserves min(quantity, total available) — callers treat a short reservation
 * as a backorder, matching the partial-fulfillment rules.
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
      ),
      calc AS (
        SELECT id,
          GREATEST(0, LEAST(avail, {{params.quantity}}::int - (running - avail))) AS take
        FROM candidates
      )
      UPDATE inventory i
      SET quantity_reserved = i.quantity_reserved + c.take
      FROM calc c
      WHERE c.id = i.id AND c.take > 0
      RETURNING i.id AS inventory_id, i.batch_id, i.warehouse_id, c.take AS reserved_qty
    `,
  });
}

export default reserveProductStockFifo;
