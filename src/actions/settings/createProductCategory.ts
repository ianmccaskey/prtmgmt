import { action } from '@uibakery/data';

/** Empty result = a category with this name already exists. */
function createProductCategory() {
  return action('createProductCategory', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO product_categories (name)
      VALUES (LOWER(TRIM({{params.name}})))
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `,
  });
}
export default createProductCategory;
