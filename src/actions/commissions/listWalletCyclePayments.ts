import { action } from '@uibakery/data';

/**
 * The individual verified payment records composing one wallet's expected
 * balance this settlement cycle — the reconciliation detail behind the
 * On-Chain Wallet Check row.
 */
function listWalletCyclePayments() {
  return action('listWalletCyclePayments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT op.id, op.amount_usd, op.tx_hash, op.direction,
        COALESCE(op.verified_at, op.quoted_at) AS recorded_at,
        so.order_number, c.full_name AS customer
      FROM order_payments op
      JOIN sales_orders so ON so.id = op.sales_order_id
      JOIN customers c ON c.id = so.customer_id
      WHERE op.receive_wallet_id = {{params.wallet_id}}::bigint
        AND op.verification_status = 'verified'
        AND COALESCE(op.verified_at, op.quoted_at) > COALESCE((SELECT MAX(settled_at) FROM settlements), '-infinity'::timestamptz)
      ORDER BY recorded_at DESC
    `,
  });
}

export default listWalletCyclePayments;
