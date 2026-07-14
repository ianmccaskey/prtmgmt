import { action } from '@uibakery/data';
function updateFreeOrderReasonActive() {
  return action('updateFreeOrderReasonActive', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `UPDATE free_order_reasons SET is_active = {{params.is_active}} WHERE id = {{params.id}}`,
  });
}
export default updateFreeOrderReasonActive;
