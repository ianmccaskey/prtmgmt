import { action } from '@uibakery/data';

/**
 * Atomic wrong-stablecoin repair used by the On-Chain Wallet Check: when a
 * payment's recorded TX hash is confirmed in the sibling stablecoin wallet's
 * deposit history (USDC recorded as USDT or vice versa), repoint the payment
 * and write the order audit row in ONE statement so a mid-flight navigation
 * can never leave a repointed payment with no audit trail.
 *
 * The caller's on-chain proof (the TX hash it confirmed and the recorded
 * amount it matched) is re-asserted HERE, against the row as it exists at
 * update time — a concurrent edit between the UI's check and this call
 * makes the repair a no-op instead of moving a changed row on stale proof.
 * An advisory transaction lock on (target wallet, hash) serializes
 * concurrent repairs so two rows can never both claim one deposit.
 *
 * Refuses (0 rows) when any of these hold:
 *  - the row's tx_hash or amount no longer matches the proof params,
 *  - the payment already points at the target asset/wallet (idempotence —
 *    a duplicate effect run must not write a second audit row),
 *  - the target wallet doesn't exist, is inactive, or its asset/network
 *    disagree with the params,
 *  - another payment on the target wallet already claims the same TX hash
 *    (repairing would double-claim one on-chain deposit),
 *  - the payment is verified inside an already-stamped settlement cycle for
 *    its own division (settled history is immutable).
 */
export function autoRepairPaymentAsset() {
  return action('autoRepairPaymentAsset', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH lck AS (
        SELECT pg_advisory_xact_lock(hashtextextended(
          {{params.walletId}}::text || ':' || LOWER(BTRIM({{params.txHash}}::text)), 0)) AS held
      ), target AS (
        SELECT op.id, op.sales_order_id, op.asset AS old_asset, op.network AS old_network
        FROM order_payments op, lck
        WHERE op.id = {{params.paymentId}}::bigint
          AND LOWER(BTRIM(op.tx_hash)) = LOWER(BTRIM({{params.txHash}}::text))
          AND NULLIF(BTRIM(op.tx_hash), '') IS NOT NULL
          AND ABS(op.amount_usd - {{params.amountUsd}}::numeric) < 0.005
          AND (op.asset <> {{params.asset}} OR op.receive_wallet_id IS DISTINCT FROM {{params.walletId}}::bigint)
          AND EXISTS (
            SELECT 1 FROM receive_wallets rw
            WHERE rw.id = {{params.walletId}}::bigint
              AND rw.asset = {{params.asset}}
              AND rw.network = {{params.network}}
              AND rw.is_active)
          AND NOT EXISTS (
            SELECT 1 FROM order_payments dup
            WHERE dup.id <> op.id
              AND dup.receive_wallet_id = {{params.walletId}}::bigint
              AND LOWER(BTRIM(dup.tx_hash)) = LOWER(BTRIM(op.tx_hash)))
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
        FOR UPDATE OF op
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
