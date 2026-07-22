import { action } from '@uibakery/data';

/**
 * What each active receive wallet is expected to hold this settlement
 * cycle: verified payments assigned to it (refunds negative) since the
 * last settlement. Settlements empty the wallets, so expected resets to
 * zero each cycle — matching the Vendor Owed card.
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
      ORDER BY rw.asset, rw.network
    `,
  });
}

export default getWalletExpectedInflows;
