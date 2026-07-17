import { action } from '@uibakery/data';

/** Change a quote's fulfillment warehouse (pre-confirmation only). */
function updateOrderPreferredWarehouse() {
  return action('updateOrderPreferredWarehouse', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders
      SET preferred_warehouse_id = {{params.warehouseId}}::bigint
      WHERE id = {{params.orderId}}::bigint
        AND status = 'quote'
      RETURNING id
    `,
  });
}
export default updateOrderPreferredWarehouse;
