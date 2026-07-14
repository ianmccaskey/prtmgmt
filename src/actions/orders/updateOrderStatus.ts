import { action } from '@uibakery/data';

export function updateOrderStatus() {
  return action('updateOrderStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders
      SET
        status = {{params.status}},
        cancellation_reason = CASE WHEN {{params.status}} = 'cancelled' THEN {{params.cancellationReason}} ELSE cancellation_reason END
      WHERE id = {{params.orderId}}::bigint
    `,
  });
}

export default updateOrderStatus;
