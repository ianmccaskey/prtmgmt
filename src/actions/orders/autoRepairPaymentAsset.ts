import { action } from '@uibakery/data';

/**
 * Atomic wrong-stablecoin repair used by the On-Chain Wallet Check: when a
 * payment's recorded TX hash is confirmed in the sibling stablecoin wallet's
 * deposit history (USDC recorded as USDT or vice versa), repoint the payment
 * and write the order audit row in ONE statement so a mid-flight navigation
 * can never leave a repointed payment with no audit trail.
 *
 * Refuses (0 rows) when any of these hold:
 *  - the payment already points at the target asset/wallet (idempotence —
 *    a duplicate effect run must not write a second audit row),
 *  - another payment on the target wallet already claims the same TX hash
 *    (repairing would double-claim one on-chain deposit),
 *  - the payment is verified inside an already-stamped settlement cycle for
 *    its own division (settled history is immutable).
 */
export function autoRepairPaymentAsset() {
  return action('autoRepairPaymentAsset', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH target AS (
        SELECT op.id, op.sales_order_id, op.asset AS old_asset, op.network AS old_network
        FROM order_payments op
        WHERE op.id = {{params.paymentId}}::bigint
          AND (op.asset <> {{params.asset}} OR op.receive_wallet_id IS DISTINCT FROM {{params.walletId}}::bigint)
          AND NOT EXISTS (
            SELECT 1 FROM order_payments dup
            WHERE dup.id <> op.id
              AND dup.receive_wallet_id = {{params.walletId}}::bigint
              AND LOWER(dup.tx_hash) = LOWER(op.tx_hash))
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
        FOR UPDATE
      ), upd AS (
        UPDATE order_payments op
        SET asset = {{params.asset}},
            network = {{params.network}},
            receive_wallet_id = {{params.walletId}}::bigint
        FROM target t
        WHERE op.id = t.id
        RETURNING op.id, t.sales_order_id, t.old_asset, t.old_network
      ), audit AS (
        INSERT INTO order_audit_log (
          sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note
        )
        SELECT u.sales_order_id, {{params.userId}}, 'other', 'payment_wallet',
               u.old_asset || '/' || u.old_network,
               {{params.asset}} || '/' || {{params.network}},
               {{params.note}}
        FROM upd u
      )
      SELECT id, sales_order_id FROM upd
    `,
  });
}

export default autoRepairPaymentAsset;
