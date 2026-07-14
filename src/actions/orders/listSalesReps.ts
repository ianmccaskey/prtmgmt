import { action } from '@uibakery/data';

function listSalesReps() {
  return action('listSalesReps', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, display_name
      FROM user_profiles
      WHERE role IN ('sales_rep', 'admin')
      ORDER BY display_name ASC
    `,
  });
}

export default listSalesReps;
