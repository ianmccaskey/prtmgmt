import { action } from '@uibakery/data';

/**
 * Edit a free-order reason. Description is always editable; the label is
 * immutable once any order uses the reason (audit trail rule) — the CASE
 * guard enforces it server-side.
 */
function updateFreeOrderReason() {
  return action('updateFreeOrderReason', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE free_order_reasons r
      SET description = {{params.description}},
          label = CASE WHEN EXISTS(SELECT 1 FROM sales_orders so WHERE so.free_order_reason_id = r.id) THEN r.label ELSE {{params.label}} END
      WHERE r.id = {{params.id}}::bigint
      RETURNING r.id
    `,
  });
}
export default updateFreeOrderReason;
