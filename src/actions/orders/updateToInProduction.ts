import { action } from '@uibakery/data';

export function updateToInProduction() {
  return action('updateToInProduction', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders SET status = 'in_production'
      WHERE id = {{params.orderId}}::bigint AND status = 'confirmed'
    `,
  });
}

export default updateToInProduction;
