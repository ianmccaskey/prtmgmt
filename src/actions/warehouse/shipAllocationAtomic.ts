import { action } from '@uibakery/data';

/**
 * One allocation shipped as ONE atomic statement (no transactions available,
 * so everything rides in a single multi-CTE statement): allocation row +
 * shipment item + ledger consumption + inventory decrement + activity log.
 * A mid-chain failure can no longer leave an allocation recorded with
 * inventory undeducted.
 *
 * quantity_reserved is decremented by the CONSUMED LEDGER amount only — the
 * portion shipped from free stock never touches other orders' reservations.
 */
function shipAllocationAtomic() {
  return action('shipAllocationAtomic', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH alloc AS (
        INSERT INTO sales_order_item_allocations
          (sales_order_item_id, batch_id, warehouse_id, quantity, allocated_by_user_id)
        VALUES (
          {{params.item_id}}::bigint,
          {{params.batch_id}}::bigint,
          {{params.warehouse_id}}::bigint,
          {{params.quantity}}::int,
          {{params.user_id}}
        )
        RETURNING id
      ),
      ship_item AS (
        INSERT INTO shipments_outbound_items (shipment_id, allocation_id, quantity_shipped)
        SELECT {{params.shipment_id}}::bigint, alloc.id, {{params.quantity}}::int FROM alloc
      ),
      ledger AS (
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
      ),
      inv AS (
        UPDATE inventory i
        SET quantity_on_hand = GREATEST(0, quantity_on_hand - {{params.quantity}}::int),
            quantity_reserved = GREATEST(0, quantity_reserved - (SELECT COALESCE(SUM(take), 0) FROM calc))
        WHERE i.id = {{params.inventory_id}}::bigint
      ),
      log AS (
        INSERT INTO warehouse_activity_log (
          warehouse_id, event_at, actor_user_id, event_type,
          product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
        )
        VALUES (
          {{params.warehouse_id}}::bigint, NOW(), {{params.user_id}}, 'outbound_pick',
          {{params.product_id}}::bigint, {{params.batch_id}}::bigint,
          -({{params.quantity}}::int), 'shipments_outbound', {{params.shipment_id}}::bigint,
          {{params.notes}}
        )
      )
      SELECT id AS allocation_id FROM alloc
    `,
  });
}

export default shipAllocationAtomic;
