import { action } from '@uibakery/data';
import { paymentRollupSql } from './paymentRollupSql';

/** Standalone rollup — call after anything that changes total_usd. */
export function recomputePaymentStatus() {
  return action('recomputePaymentStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: paymentRollupSql('{{params.orderId}}::bigint'),
  });
}

export default recomputePaymentStatus;
