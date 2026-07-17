import { action } from '@uibakery/data';

function updateFactory() {
  return action('updateFactory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE factories
      SET name = TRIM({{params.name}}), notes = {{params.notes}}
      WHERE id = {{params.id}}::bigint
      RETURNING id
    `,
  });
}
export default updateFactory;
