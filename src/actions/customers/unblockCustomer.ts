import { action } from '@uibakery/data';

export function unblockCustomer() {
  return action('unblockCustomer', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE customers SET
        is_blocked = false,
        blocked_reason = NULL,
        blocked_at = NULL,
        blocked_by_user_id = NULL
      WHERE id = {{params.customerId}}::bigint
    `,
  });
}

export default unblockCustomer;
