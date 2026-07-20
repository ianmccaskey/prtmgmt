import { action } from '@uibakery/data';

function deleteParcelTemplate() {
  return action('deleteParcelTemplate', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `DELETE FROM warehouse_parcel_templates WHERE id = {{params.id}}::bigint RETURNING id`,
  });
}

export default deleteParcelTemplate;
