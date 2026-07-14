import { action } from '@uibakery/data';

export function getFreeOrderReasons() {
  return action('getFreeOrderReasons', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, label, description
      FROM free_order_reasons
      WHERE is_active = true
      ORDER BY label
    `,
  });
}

export default getFreeOrderReasons;
