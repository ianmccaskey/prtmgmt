import { action } from '@uibakery/data';

/**
 * On ship: decrement on-hand AND reserved on one inventory row, and consume
 * this order's reservation-ledger rows for that inventory row (delete fully
 * consumed rows, shrink a partially consumed one — the ledger CHECK forbids
 * quantity <= 0, so full consumption must delete, not update).
 * GREATEST guards keep counters non-negative for seed rows with reservations
 * that predate the ledger.
 */
function deductShippedInventory() {
  return action('deductShippedInventory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH ledger AS (
        SELECT id, quantity,
          SUM(quantity) OVER (ORDER BY id ASC) AS running
        FROM inventory_reservations
        WHERE sales_order_id = {{params.order_id}}::bigint
          AND inventory_id = {{params.inventory_id}}::bigint
      ),
      calc AS (
        SELECT id, quantity,
          GREATEST(0, LEAST(quantity, {{params.quantity}}::int - (running - quantity))) AS take
        FROM ledger
      ),
      consumed_full AS (
        DELETE FROM inventory_reservations ir
        USING calc c
        WHERE ir.id = c.id AND c.take > 0 AND c.take >= c.quantity
      ),
      consumed_part AS (
        UPDATE inventory_reservations ir
        SET quantity = ir.quantity - c.take
        FROM calc c
        WHERE ir.id = c.id AND c.take > 0 AND c.take < c.quantity
      )
      UPDATE inventory i
      SET quantity_on_hand = GREATEST(0, quantity_on_hand - {{params.quantity}}::int),
          quantity_reserved = GREATEST(0, quantity_reserved - {{params.quantity}}::int)
      WHERE i.id = {{params.inventory_id}}::bigint
      RETURNING i.id, i.quantity_on_hand, i.quantity_reserved
    `,
  });
}

export default deductShippedInventory;
