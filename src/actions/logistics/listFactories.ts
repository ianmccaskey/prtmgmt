import { action } from '@uibakery/data';

function listFactories() {
  return action('listFactories', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `SELECT id, name, notes FROM factories ORDER BY name ASC`,
  });
}

export default listFactories;
