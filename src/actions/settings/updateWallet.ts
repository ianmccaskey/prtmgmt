import { action } from '@uibakery/data';

/**
 * Edit a receive wallet. Label and notes are always editable; asset,
 * network, and address only change while no payment references the wallet
 * (payment history must keep pointing at the address it was actually paid
 * to). The UI disables those fields for used wallets; the CASE guards make
 * the rule hold even against a stale client.
 */
function updateWallet() {
  return action('updateWallet', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE receive_wallets w
      SET label = {{params.label}},
          notes = {{params.notes}},
          asset = CASE WHEN EXISTS(SELECT 1 FROM order_payments op WHERE op.receive_wallet_id = w.id) THEN w.asset ELSE {{params.asset}} END,
          network = CASE WHEN EXISTS(SELECT 1 FROM order_payments op WHERE op.receive_wallet_id = w.id) THEN w.network ELSE {{params.network}} END,
          address = CASE WHEN EXISTS(SELECT 1 FROM order_payments op WHERE op.receive_wallet_id = w.id) THEN w.address ELSE {{params.address}} END
      WHERE w.id = {{params.id}}::bigint
      RETURNING w.id,
        EXISTS(SELECT 1 FROM order_payments op WHERE op.receive_wallet_id = w.id) AS locked
    `,
  });
}
export default updateWallet;
