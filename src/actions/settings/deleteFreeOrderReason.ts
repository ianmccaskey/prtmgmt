import { action } from '@uibakery/data';

/**
 * Delete a free-order reason — only when no order references it. Empty
 * result = blocked; deactivate instead.
 */
function deleteFreeOrderReason() {
  return action('deleteFreeOrderReason', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM free_order_reasons r
      WHERE r.id = {{params.id}}::bigint
        AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.free_order_reason_id = r.id)
      RETURNING r.id
    `,
  });
}
export default deleteFreeOrderReason;
