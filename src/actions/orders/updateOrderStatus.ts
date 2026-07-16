import { action } from '@uibakery/data';

/**
 * Status update with the allowed-transition chain enforced in SQL:
 * quote→confirmed (ONLY when payment_status is paid/partial_paid),
 * shipped→delivered, and cancelled from quote/confirmed/partially_shipped.
 * Shipping transitions happen only through the fulfillment/china flows.
 * Returns zero rows when the transition isn't allowed.
 */
export function updateOrderStatus() {
  return action('updateOrderStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders
      SET
        status = {{params.status}},
        cancellation_reason = CASE WHEN {{params.status}} = 'cancelled' THEN {{params.cancellationReason}} ELSE cancellation_reason END
      WHERE id = {{params.orderId}}::bigint
        AND (
          ({{params.status}} = 'confirmed' AND status = 'quote' AND payment_status IN ('paid', 'partial_paid')) OR
          ({{params.status}} = 'delivered' AND status = 'shipped') OR
          ({{params.status}} = 'cancelled' AND status IN ('quote', 'confirmed', 'partially_shipped'))
        )
      RETURNING id, status
    `,
  });
}

export default updateOrderStatus;
