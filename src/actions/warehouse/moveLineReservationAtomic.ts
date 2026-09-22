import { action } from '@uibakery/data';

/**
 * Move N reserved kits of one order+product from one warehouse to another
 * — the "split a line across warehouses" primitive. One atomic statement:
 *
 *  - Source reservation rows are LOCKED (FOR UPDATE), then shrunk/deleted
 *    oldest-row-first until N is released; the source inventory counters
 *    drop in the same statement.
 *  - Destination stock re-reserves FIFO by batch manufacture date
 *    (passed-QC only), exactly like reserveProductStockFifo, with the
 *    same lock-time re-check so a concurrent reservation can't
 *    over-reserve a row.
 *  - The whole move is gated (0 rows moved) unless the source actually
 *    holds >= N AND the destination snapshot shows >= N available, and
 *    from <> to.
 *
 * Known residual (same accepted race as the confirm/move flows): if a
 * concurrent reservation eats destination stock between the gate and the
 * re-check, the released amount can exceed the re-reserved amount — the
 * result row reports both, and the caller surfaces the shortfall as a
 * backorder instead of hiding it.
 */
function moveLineReservationAtomic() {
  return action('moveLineReservationAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH locked AS (
        SELECT ir.id, ir.inventory_id, ir.quantity
        FROM inventory_reservations ir
        JOIN inventory i ON i.id = ir.inventory_id
        WHERE ir.sales_order_id = {{params.order_id}}::bigint
          AND ir.product_id = {{params.product_id}}::bigint
          AND i.warehouse_id = {{params.from_warehouse_id}}::bigint
        FOR UPDATE OF ir
      ),
      src AS (
        SELECT id, inventory_id, quantity,
          SUM(quantity) OVER (ORDER BY id ASC) AS running
        FROM locked
      ),
      ok AS (
        SELECT ({{params.quantity}}::int > 0)
          AND ({{params.from_warehouse_id}}::bigint <> {{params.to_warehouse_id}}::bigint)
          AND COALESCE((SELECT SUM(quantity) FROM locked), 0) >= {{params.quantity}}::int
          AND COALESCE((SELECT SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved))
                        FROM inventory i JOIN product_batches pb ON pb.id = i.batch_id
                        WHERE i.product_id = {{params.product_id}}::bigint
                          AND i.warehouse_id = {{params.to_warehouse_id}}::bigint
                          AND pb.qc_status = 'passed'), 0) >= {{params.quantity}}::int
          AS go
      ),
      calc AS (
        SELECT s.id, s.inventory_id, s.quantity,
          GREATEST(0, LEAST(s.quantity, {{params.quantity}}::int - (s.running - s.quantity))) AS take
        FROM src s WHERE (SELECT go FROM ok)
      ),
      shrink AS (
        UPDATE inventory_reservations r SET quantity = r.quantity - c.take
        FROM calc c WHERE r.id = c.id AND c.take > 0 AND c.take < c.quantity
        RETURNING r.id
      ),
      drop_full AS (
        DELETE FROM inventory_reservations r USING calc c
        WHERE r.id = c.id AND c.take > 0 AND c.take = c.quantity
        RETURNING r.id
      ),
      src_inv AS (
        UPDATE inventory i SET quantity_reserved = GREATEST(0, i.quantity_reserved - t.rel)
        FROM (SELECT inventory_id, SUM(take) AS rel FROM calc WHERE take > 0 GROUP BY inventory_id) t
        WHERE i.id = t.inventory_id
        RETURNING i.id
      ),
      dest_candidates AS (
        SELECT i.id, (i.quantity_on_hand - i.quantity_reserved) AS avail,
          SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved))
            OVER (ORDER BY pb.manufacture_date ASC NULLS LAST, i.id ASC) AS running
        FROM inventory i
        JOIN product_batches pb ON pb.id = i.batch_id
        WHERE i.product_id = {{params.product_id}}::bigint
          AND i.warehouse_id = {{params.to_warehouse_id}}::bigint
          AND pb.qc_status = 'passed'
          AND (i.quantity_on_hand - i.quantity_reserved) > 0
          AND (SELECT go FROM ok)
      ),
      dest_calc AS (
        SELECT id, GREATEST(0, LEAST(avail, {{params.quantity}}::int - (running - avail))) AS take
        FROM dest_candidates
      ),
      dest_upd AS (
        UPDATE inventory i SET quantity_reserved = i.quantity_reserved + c.take
        FROM dest_calc c
        WHERE c.id = i.id AND c.take > 0
          AND i.quantity_reserved + c.take <= i.quantity_on_hand
        RETURNING i.id AS inventory_id, i.product_id, c.take
      ),
      dest_ins AS (
        INSERT INTO inventory_reservations (sales_order_id, product_id, inventory_id, quantity)
        SELECT {{params.order_id}}::bigint, product_id, inventory_id, take FROM dest_upd
        RETURNING quantity
      )
      SELECT
        COALESCE((SELECT SUM(take) FROM calc WHERE take > 0), 0)::int AS released,
        COALESCE((SELECT SUM(quantity) FROM dest_ins), 0)::int AS reserved
    `,
  });
}

export default moveLineReservationAtomic;
