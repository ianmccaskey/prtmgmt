import { action } from '@uibakery/data';

/**
 * Everything paid out in one settlement's cycle: the payouts the settlement
 * itself recorded (settlement_id = X) plus manual payments made during the
 * cycle window — after the previous stamp, up to this one (those reduced
 * what the settlement had to pay). at_settlement distinguishes the two.
 */
function listSettlementPayments() {
  return action('listSettlementPayments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT cp.id, cp.payee_type, cp.amount_usd, cp.paid_at, cp.note,
        (cp.settlement_id IS NOT NULL) AS at_settlement,
        rep.display_name AS sales_rep_name,
        w.name AS warehouse_name
      FROM commission_payments cp
      LEFT JOIN user_profiles rep ON rep.id = cp.sales_rep_user_profile_id
      LEFT JOIN warehouses w ON w.id = cp.warehouse_id
      WHERE cp.settlement_id = {{params.settlement_id}}::bigint
         OR (
           cp.settlement_id IS NULL
           AND cp.paid_at <= (SELECT settled_at FROM settlements WHERE id = {{params.settlement_id}}::bigint)
           AND cp.paid_at > COALESCE(
             (SELECT MAX(s2.settled_at) FROM settlements s2
              WHERE s2.settled_at < (SELECT settled_at FROM settlements WHERE id = {{params.settlement_id}}::bigint)),
             '-infinity'::timestamptz
           )
         )
      ORDER BY (cp.settlement_id IS NULL),
        CASE cp.payee_type WHEN 'sales_rep' THEN 1 WHEN 'warehouse' THEN 2 ELSE 3 END,
        cp.amount_usd DESC
    `,
  });
}

export default listSettlementPayments;
