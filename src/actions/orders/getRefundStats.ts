import { action } from '@uibakery/data';

export function getRefundStats() {
  return action('getRefundStats', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        (SELECT COUNT(*) FROM refund_tasks WHERE status = 'owed') AS owed_count,
        (SELECT COALESCE(SUM(amount_usd_owed),0) FROM refund_tasks WHERE status = 'owed') AS owed_usd,
        (SELECT COUNT(*) FROM refund_tasks WHERE status = 'owed' AND due_date < CURRENT_DATE) AS overdue_count,
        (SELECT COUNT(*) FROM refund_tasks
          WHERE status = 'sent'
          AND sent_at >= DATE_TRUNC('week', CURRENT_DATE)) AS sent_this_week,
        (SELECT COUNT(*) FROM refund_tasks
          WHERE status = 'verified'
          AND verified_at >= DATE_TRUNC('week', CURRENT_DATE)) AS verified_this_week
    `,
  });
}

export default getRefundStats;
