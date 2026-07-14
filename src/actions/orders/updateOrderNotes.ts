import { action } from '@uibakery/data';

/** Notes stay editable in every status (prompt: cancelled/delivered are read-only EXCEPT notes). */
export function updateOrderNotes() {
  return action('updateOrderNotes', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders SET notes = {{params.notes}}
      WHERE id = {{params.orderId}}::bigint
      RETURNING id
    `,
  });
}

export default updateOrderNotes;
