import { action } from '@uibakery/data';

function updateOrderSalesRep() {
  return action('updateOrderSalesRep', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE sales_orders
      SET sales_rep_user_profile_id = {{params.salesRepUserProfileId}}::bigint
      WHERE id = {{params.orderId}}::bigint
    `,
  });
}

export default updateOrderSalesRep;
