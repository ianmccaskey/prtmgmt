import { action } from '@uibakery/data';

/** Allocation + its shipment item in one atomic statement (CTE pattern). */
function createAllocationWithShipmentItem() {
  return action('createAllocationWithShipmentItem', 'SQL', {
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
      )
      INSERT INTO shipments_outbound_items (shipment_id, allocation_id, quantity_shipped)
      SELECT {{params.shipment_id}}::bigint, alloc.id, {{params.quantity}}::int FROM alloc
      RETURNING allocation_id
    `,
  });
}

export default createAllocationWithShipmentItem;
