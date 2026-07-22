import { action } from '@uibakery/data';

/** Vendor remittances, newest first. */
function listVendorPayments() {
  return action('listVendorPayments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT cp.id, cp.amount_usd, cp.paid_at, cp.note, up.display_name AS paid_by
      FROM commission_payments cp
      LEFT JOIN user_profiles up ON up.id = cp.paid_by_user_id
      WHERE cp.payee_type = 'vendor'
      ORDER BY cp.paid_at DESC
    `,
  });
}

export default listVendorPayments;
