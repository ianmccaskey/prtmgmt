import { action } from '@uibakery/data';
function updateWarehouseActive() {
  return action('updateWarehouseActive', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `UPDATE warehouses SET is_active = {{params.is_active}} WHERE id = {{params.id}}`,
  });
}
export default updateWarehouseActive;
