import { action } from '@uibakery/data';
function createFreeOrderReason() {
  return action('createFreeOrderReason', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `INSERT INTO free_order_reasons (label, description, is_active) VALUES ({{params.label}}, {{params.description}}, true) RETURNING id`,
  });
}
export default createFreeOrderReason;
