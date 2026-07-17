import { action } from '@uibakery/data';

function listProductCategories() {
  return action('listProductCategories', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT pc.id, pc.name, pc.is_active,
        EXISTS(SELECT 1 FROM products p WHERE p.category = pc.name) AS is_used
      FROM product_categories pc
      ORDER BY pc.name ASC
    `,
  });
}
export default listProductCategories;
