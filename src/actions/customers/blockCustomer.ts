import { action } from '@uibakery/data';

export function blockCustomer() {
  return action('blockCustomer', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE customers SET
        is_blocked = true,
        blocked_reason = {{params.reason}},
        blocked_at = NOW(),
        blocked_by_user_id = {{params.userId}}
      WHERE id = {{params.customerId}}::bigint
    `,
  });
}

export default blockCustomer;
