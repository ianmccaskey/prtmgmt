import { action } from '@uibakery/data';

/**
 * Manually reserve stock on one inventory row without a sales order — one
 * atomic statement: bumps quantity_reserved (guarded so a hold can never
 * exceed what's actually available) and writes the hold's ledger row with
 * reason + who placed it. 0 rows = not enough available stock.
 */
export function createStockHold() {
  return action('createStockHold', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH upd AS (
        UPDATE inventory i
        SET quantity_reserved = i.quantity_reserved + {{params.quantity}}::int
        WHERE i.id = {{params.inventory_id}}::bigint
          AND {{params.quantity}}::int > 0
          AND i.quantity_on_hand - i.quantity_reserved >= {{params.quantity}}::int
        RETURNING i.id, i.product_id
      )
      INSERT INTO inventory_reservations (sales_order_id, product_id, inventory_id, quantity, hold_reason, created_by_user_id)
      SELECT NULL, u.product_id, u.id, {{params.quantity}}::int, {{params.reason}}, {{params.userId}}::bigint
      FROM upd u
      RETURNING id
    `,
  });
}

export default createStockHold;
