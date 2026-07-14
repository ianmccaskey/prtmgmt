import { action } from '@uibakery/data';

/**
 * Release an order's ledgered reservations (all products, or one product when
 * {{params.product_id}} is set). Deletes the ledger rows and decrements the
 * exact inventory rows they pointed at — never touches other orders' stock.
 */
function releaseProductReservation() {
  return action('releaseProductReservation', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH del AS (
        DELETE FROM inventory_reservations
        WHERE sales_order_id = {{params.order_id}}::bigint
          AND ({{params.product_id}} IS NULL OR product_id = {{params.product_id}}::bigint)
        RETURNING inventory_id, quantity
      ),
      agg AS (
        SELECT inventory_id, SUM(quantity) AS qty FROM del GROUP BY inventory_id
      )
      UPDATE inventory i
      SET quantity_reserved = GREATEST(0, i.quantity_reserved - a.qty)
      FROM agg a
      WHERE a.inventory_id = i.id
      RETURNING i.id AS inventory_id, a.qty AS released_qty
    `,
  });
}

export default releaseProductReservation;
