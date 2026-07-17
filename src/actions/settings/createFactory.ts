import { action } from '@uibakery/data';

function createFactory() {
  return action('createFactory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO factories (name, notes)
      VALUES (TRIM({{params.name}}), {{params.notes}})
      RETURNING id
    `,
  });
}
export default createFactory;
