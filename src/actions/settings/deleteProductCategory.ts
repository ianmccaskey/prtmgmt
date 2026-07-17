import { action } from '@uibakery/data';

/** Delete a category — only when no product uses it. Empty result = blocked. */
function deleteProductCategory() {
  return action('deleteProductCategory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      DELETE FROM product_categories pc
      WHERE pc.id = {{params.id}}::bigint
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category = pc.name)
      RETURNING pc.id
    `,
  });
}
export default deleteProductCategory;
