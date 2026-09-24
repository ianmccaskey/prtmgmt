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
 *
 * Cross-warehouse cleanup: when this warehouse ships a line whose
 * reservations live at ANOTHER warehouse (order assigned there, shipped
 * here), those stale reservations are released — same order + product,
 * other inventory rows, oldest first, capped at the shipped quantity not
 * covered by locally-consumed ledger. Each release logs a
 * 'reservation_released' activity row at the releasing warehouse. Manual
 * holds (no order) are never touched.
 *
 * The ORDER STATUS flip rides in the same statement (2026-09 hardening —
 * ORD-2026-0239 shipped fully but stayed 'confirmed' because the
 * browser's separate flip call never ran). Sub-statements share one
 * snapshot, so the derived-status check can't see this statement's own
 * allocation insert — this item's quantity is added manually, mirroring
 * receiveLineAtomic. The dialog's trailing markOrderShippedFromWarehouse
 * call remains as an idempotent belt-and-braces repair.
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
      other_ledger AS (
        SELECT ir.id, ir.quantity, ir.inventory_id,
          SUM(ir.quantity) OVER (ORDER BY ir.id ASC) AS running
        FROM inventory_reservations ir
        WHERE ir.sales_order_id = {{params.order_id}}::bigint
          AND ir.product_id = {{params.product_id}}::bigint
          AND ir.inventory_id <> {{params.inventory_id}}::bigint
      ),
      other_calc AS (
        SELECT ol.id, ol.quantity, ol.inventory_id,
          GREATEST(0, LEAST(ol.quantity,
            ({{params.quantity}}::int - (SELECT COALESCE(SUM(take), 0) FROM calc))
              - (ol.running - ol.quantity))) AS take
        FROM other_ledger ol
      ),
      other_released_full AS (
        DELETE FROM inventory_reservations ir
        USING other_calc c
        WHERE ir.id = c.id AND c.take > 0 AND c.take >= c.quantity
      ),
      other_released_part AS (
        UPDATE inventory_reservations ir
        SET quantity = ir.quantity - c.take
        FROM other_calc c
        WHERE ir.id = c.id AND c.take > 0 AND c.take < c.quantity
      ),
      other_sums AS (
        SELECT inventory_id, SUM(take) AS released
        FROM other_calc WHERE take > 0 GROUP BY inventory_id
      ),
      other_inv AS (
        UPDATE inventory i
        SET quantity_reserved = GREATEST(0, i.quantity_reserved - os.released)
        FROM other_sums os WHERE i.id = os.inventory_id
      ),
      other_log AS (
        INSERT INTO warehouse_activity_log (
          warehouse_id, event_at, actor_user_id, event_type,
          product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes
        )
        SELECT i.warehouse_id, NOW(), {{params.user_id}}, 'reservation_released',
          {{params.product_id}}::bigint, i.batch_id, 0,
          'shipments_outbound', {{params.shipment_id}}::bigint,
          'Released ' || os.released || ' reserved kit(s) — line shipped from another warehouse'
        FROM other_sums os JOIN inventory i ON i.id = os.inventory_id
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
      ),
      order_status AS (
        UPDATE sales_orders so
        SET status = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM sales_order_items soi
            LEFT JOIN (
              SELECT sales_order_item_id, SUM(quantity) AS q
              FROM sales_order_item_allocations GROUP BY sales_order_item_id
            ) a ON a.sales_order_item_id = soi.id
            WHERE soi.sales_order_id = {{params.order_id}}::bigint
              AND soi.fulfillment_source = 'warehouse'
              AND COALESCE(a.q, 0)
                  + CASE WHEN soi.id = {{params.item_id}}::bigint THEN {{params.quantity}}::int ELSE 0 END
                < soi.quantity
          )
          AND NOT EXISTS (
            SELECT 1 FROM sales_order_items soi
            WHERE soi.sales_order_id = {{params.order_id}}::bigint
              AND soi.fulfillment_source = 'china_direct'
              AND NOT EXISTS (
                SELECT 1 FROM shipments_outbound sob
                WHERE sob.sales_order_id = soi.sales_order_id AND sob.origin = 'china'
              )
          )
          THEN 'shipped' ELSE 'partially_shipped' END
        WHERE so.id = {{params.order_id}}::bigint
          AND so.status IN ('confirmed', 'partially_shipped')
      )
      SELECT id AS allocation_id FROM alloc
    `,
  });
}

export default shipAllocationAtomic;
