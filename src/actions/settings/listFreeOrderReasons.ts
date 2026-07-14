import { action } from '@uibakery/data';
function listFreeOrderReasons() {
  return action('listFreeOrderReasons', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        r.id, r.label, r.description, r.is_active,
        EXISTS(SELECT 1 FROM sales_orders so WHERE so.free_order_reason_id = r.id) AS is_used
      FROM free_order_reasons r
      ORDER BY r.label ASC
    `,
  });
}
export default listFreeOrderReasons;
