import { action } from '@uibakery/data';

/**
 * Admin correction for a payment recorded against the wrong asset, network,
 * receive wallet, or transaction (e.g. USDC-SOL money logged as USDC-ETH,
 * or an ETH deposit swapped into USDC where the record must follow the
 * money to the swap TX). Amount and verification status are untouched;
 * callers audit-log the change. tx_hash semantics: NULL = keep the current
 * hash, '' = clear it, anything else = replace it.
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
          receive_wallet_id = {{params.walletId}}::bigint,
          tx_hash = CASE
            WHEN {{params.txHash}}::text IS NULL THEN op.tx_hash
            ELSE NULLIF({{params.txHash}}::text, '')
          END
      WHERE op.id = {{params.paymentId}}::bigint
        AND (op.verification_status <> 'verified'
             -- Division-aware: only the payment's OWN division's stamp
             -- freezes it (a China settlement must not lock US payments).
             OR op.verified_at > COALESCE((
                  SELECT MAX(s.settled_at) FROM settlements s
                  WHERE s.division = (
                    SELECT COALESCE(rp.division, 'us')
                    FROM sales_orders so2
                    LEFT JOIN user_profiles rp ON rp.id = so2.sales_rep_user_profile_id
                    WHERE so2.id = op.sales_order_id)
                ), '-infinity'::timestamptz))
      RETURNING op.id, op.asset, op.network, op.receive_wallet_id
    `,
  });
}

export default updatePaymentWallet;
