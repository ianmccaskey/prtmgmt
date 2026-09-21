import { action } from '@uibakery/data';

/**
 * Release a manual stock hold, fully or in increments — one atomic
 * statement. quantity < held → the hold's ledger row shrinks by that
 * much; quantity >= held → the row is deleted (full release). Either
 * way the released amount returns to available. The hold row is locked
 * (FOR UPDATE) so two concurrent partial releases serialize instead of
 * double-subtracting. Manual holds only; order reservations are
 * untouchable here. GREATEST guards a counter that drifted low
 * (pre-ledger seed data) from going negative. 0 rows = hold not found
 * or quantity <= 0.
 */
export function releaseStockHold() {
  return action('releaseStockHold', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH tgt AS (
        SELECT r.id, r.inventory_id, r.quantity AS held,
               LEAST({{params.quantity}}::int, r.quantity) AS rel
        FROM inventory_reservations r
        WHERE r.id = {{params.hold_id}}::bigint
          AND r.sales_order_id IS NULL
          AND {{params.quantity}}::int > 0
        FOR UPDATE
      ),
      del AS (
        DELETE FROM inventory_reservations r
        USING tgt
        WHERE r.id = tgt.id AND tgt.rel >= tgt.held
        RETURNING r.id
      ),
      shrink AS (
        UPDATE inventory_reservations r
        SET quantity = r.quantity - tgt.rel
        FROM tgt
        WHERE r.id = tgt.id AND tgt.rel < tgt.held
        RETURNING r.id
      )
      UPDATE inventory i
      SET quantity_reserved = GREATEST(0, i.quantity_reserved - tgt.rel)
      FROM tgt
      WHERE i.id = tgt.inventory_id
      RETURNING i.id, tgt.rel AS released
    `,
  });
}

export default releaseStockHold;
