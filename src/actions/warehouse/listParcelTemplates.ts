import { action } from '@uibakery/data';

/** Shipping box templates, optionally scoped to one warehouse ('' = all). */
function listParcelTemplates() {
  return action('listParcelTemplates', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT id, warehouse_id, name, length_in, width_in, height_in, default_weight_lb
      FROM warehouse_parcel_templates
      WHERE (COALESCE({{params.warehouse_id}}, '') = '' OR warehouse_id::text = {{params.warehouse_id}})
      ORDER BY warehouse_id, name
    `,
  });
}

export default listParcelTemplates;
