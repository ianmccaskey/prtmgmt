import { action } from '@uibakery/data';

/**
 * Rename and/or toggle a category. Renames cascade to products via the
 * FK's ON UPDATE CASCADE, so existing products follow automatically.
 */
function updateProductCategory() {
  return action('updateProductCategory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE product_categories
      SET name = LOWER(TRIM({{params.name}})), is_active = {{params.is_active}}::boolean
      WHERE id = {{params.id}}::bigint
      RETURNING id
    `,
  });
}
export default updateProductCategory;
