import { action } from '@uibakery/data';
import { paymentRollupSql } from './paymentRollupSql';

export function markPaymentVerified() {
  return action('markPaymentVerified', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE order_payments
      SET verification_status = 'verified',
          verified_at = NOW(),
          verified_by_user_id = {{params.userId}}
      WHERE id = {{params.paymentId}}::bigint;
${paymentRollupSql(`SELECT sales_order_id FROM order_payments WHERE id = {{params.paymentId}}::bigint`)};
    `,
  });
}

export default markPaymentVerified;
