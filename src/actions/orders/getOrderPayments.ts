import { action } from '@uibakery/data';

export function getOrderPayments() {
  return action('getOrderPayments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        op.*,
        rw.address AS wallet_address
      FROM order_payments op
      LEFT JOIN receive_wallets rw ON rw.id = op.receive_wallet_id
      WHERE op.sales_order_id = {{params.orderId}}::bigint
      ORDER BY op.created_at ASC
    `,
  });
}

export default getOrderPayments;
