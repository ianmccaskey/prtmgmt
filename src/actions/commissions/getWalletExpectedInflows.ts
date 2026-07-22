import { action } from '@uibakery/data';

/**
 * What each active receive wallet is expected to hold this settlement
 * cycle: verified payments assigned to it (refunds negative) since the
 * last settlement. Settlements empty the wallets, so expected resets to
 * zero each cycle — matching the Vendor Owed card. A final NULL-id row
 * carries verified activity with no wallet link (refund rows never carry
 * one) so per-wallet totals + unassigned always reconcile to the cycle's
 * collections.
 */
function getWalletExpectedInflows() {
  return action('getWalletExpectedInflows', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT rw.id, rw.asset, rw.network, rw.address, rw.label,
        COALESCE(SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END), 0)::numeric(14,2) AS expected_usd,
        COUNT(op.id)::int AS payments_count
      FROM receive_wallets rw
      LEFT JOIN order_payments op ON op.receive_wallet_id = rw.id
        AND op.verification_status = 'verified'
        AND COALESCE(op.verified_at, op.quoted_at) > COALESCE((SELECT MAX(settled_at) FROM settlements), '-infinity'::timestamptz)
      WHERE rw.is_active = true
      GROUP BY rw.id, rw.asset, rw.network, rw.address, rw.label
      UNION ALL
      SELECT NULL::bigint, 'UNASSIGNED', '', '', 'Not tied to a wallet (incl. refunds)',
        COALESCE(SUM(CASE WHEN op.direction = 'refund' THEN -op.amount_usd ELSE op.amount_usd END), 0)::numeric(14,2),
        COUNT(op.id)::int
      FROM order_payments op
      WHERE op.receive_wallet_id IS NULL
        AND op.verification_status = 'verified'
        AND COALESCE(op.verified_at, op.quoted_at) > COALESCE((SELECT MAX(settled_at) FROM settlements), '-infinity'::timestamptz)
      HAVING COUNT(op.id) > 0
      ORDER BY 2, 3
    `,
  });
}

export default getWalletExpectedInflows;
