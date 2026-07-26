import { action } from '@uibakery/data';

/**
 * Admin correction for a payment recorded against the wrong asset, network,
 * or receive wallet (e.g. USDC-SOL money logged as USDC-ETH). Amount and
 * verification status are untouched; callers audit-log the change.
 *
 * Refuses (0 rows) when the payment is a verified one that already counted
 * in a stamped settlement cycle — repointing it would rewrite settled
 * history. Pending/flagged payments never count in settlements, so those
 * are always editable.
 */
export function updatePaymentWallet() {
  return action('updatePaymentWallet', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE order_payments op
      SET asset = {{params.asset}},
          network = {{params.network}},
          receive_wallet_id = {{params.walletId}}::bigint
      WHERE op.id = {{params.paymentId}}::bigint
        AND (op.verification_status <> 'verified'
             OR op.verified_at > COALESCE((SELECT MAX(settled_at) FROM settlements), '-infinity'::timestamptz))
      RETURNING op.id, op.asset, op.network, op.receive_wallet_id
    `,
  });
}

export default updatePaymentWallet;
