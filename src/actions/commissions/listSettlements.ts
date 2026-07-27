import { action } from '@uibakery/data';

/** Settlement stamps, newest first. */
function listSettlements() {
  return action('listSettlements', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT s.id, s.settled_at, s.collected_usd, s.rep_commissions_usd,
        s.warehouse_earned_usd, s.vendor_share_usd, s.note, s.division,
        up.display_name AS created_by
      FROM settlements s
      LEFT JOIN user_profiles up ON up.id = s.created_by_user_id
      WHERE s.division = COALESCE(NULLIF({{params.division}}, ''), 'us')
      ORDER BY s.settled_at DESC
    `,
  });
}

export default listSettlements;
