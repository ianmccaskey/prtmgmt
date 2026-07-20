import { action } from '@uibakery/data';

function createParcelTemplate() {
  return action('createParcelTemplate', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO warehouse_parcel_templates (warehouse_id, name, length_in, width_in, height_in, default_weight_lb)
      VALUES (
        {{params.warehouse_id}}::bigint,
        {{params.name}},
        {{params.length_in}}::numeric,
        {{params.width_in}}::numeric,
        {{params.height_in}}::numeric,
        NULLIF({{params.default_weight_lb}}::text, '')::numeric
      )
      RETURNING id
    `,
  });
}

export default createParcelTemplate;
