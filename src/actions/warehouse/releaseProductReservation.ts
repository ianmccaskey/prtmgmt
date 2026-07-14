import { action } from '@uibakery/data';

/**
 * Release up to {{params.quantity}} reserved kits of a product, walking
 * inventory rows in id order. Releases min(quantity, total reserved) —
 * GREATEST guards keep quantity_reserved from going negative.
 */
function releaseProductReservation() {
  return action('releaseProductReservation', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH candidates AS (
        SELECT id, quantity_reserved,
          SUM(quantity_reserved) OVER (ORDER BY id ASC) AS running
        FROM inventory
        WHERE product_id = {{params.product_id}}::bigint
          AND quantity_reserved > 0
      ),
      calc AS (
        SELECT id,
          GREATEST(0, LEAST(quantity_reserved, {{params.quantity}}::int - (running - quantity_reserved))) AS release_qty
        FROM candidates
      )
      UPDATE inventory i
      SET quantity_reserved = GREATEST(0, i.quantity_reserved - c.release_qty)
      FROM calc c
      WHERE c.id = i.id AND c.release_qty > 0
      RETURNING i.id AS inventory_id, c.release_qty
    `,
  });
}

export default releaseProductReservation;
