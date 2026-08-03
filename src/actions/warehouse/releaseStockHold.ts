import { action } from '@uibakery/data';

/**
 * Release one manual stock hold — one atomic statement: deletes the hold's
 * ledger row (manual holds only; order reservations are untouchable here)
 * and returns the quantity to available. GREATEST guards a counter that
 * drifted low (pre-ledger seed data) from going negative.
 */
export function releaseStockHold() {
  return action('releaseStockHold', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH del AS (
        DELETE FROM inventory_reservations r
        WHERE r.id = {{params.hold_id}}::bigint AND r.sales_order_id IS NULL
        RETURNING r.inventory_id, r.quantity
      )
      UPDATE inventory i
      SET quantity_reserved = GREATEST(0, i.quantity_reserved - d.quantity)
      FROM del d
      WHERE i.id = d.inventory_id
      RETURNING i.id
    `,
  });
}

export default releaseStockHold;
