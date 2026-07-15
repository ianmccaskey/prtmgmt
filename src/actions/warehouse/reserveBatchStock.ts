import { action } from '@uibakery/data';

/**
 * Batch-pinned variant of reserveProductStockFifo: reserve up to
 * {{params.quantity}} kits for an order from ONE specific passed-QC batch,
 * walking that batch's inventory rows across warehouses. Same ledger
 * bookkeeping and same concurrency guard (the UPDATE re-checks
 * reserved + take <= on_hand, so a losing race under-reserves instead of
 * over-reserving). Returns the reserved rows; the caller tops up any
 * shortfall via the product-level FIFO reserve.
 */
function reserveBatchStock() {
  return action('reserveBatchStock', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH candidates AS (
        SELECT i.id,
          (i.quantity_on_hand - i.quantity_reserved) AS avail,
          SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved))
            OVER (ORDER BY i.id ASC) AS running
        FROM inventory i
        JOIN product_batches pb ON pb.id = i.batch_id
        WHERE i.product_id = {{params.product_id}}::bigint
          AND i.batch_id = {{params.batch_id}}::bigint
          AND pb.qc_status = 'passed'
          AND (i.quantity_on_hand - i.quantity_reserved) > 0
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

export default reserveBatchStock;
