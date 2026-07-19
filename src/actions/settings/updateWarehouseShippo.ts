import { action } from '@uibakery/data';

/**
 * Set a warehouse's Shippo API key + ship-from phone. api_key semantics:
 * NULL = keep the current key, '' = remove it, anything else = replace it.
 */
function updateWarehouseShippo() {
  return action('updateWarehouseShippo', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE warehouses SET
        shippo_api_key = CASE
          WHEN {{params.api_key}}::text IS NULL THEN shippo_api_key
          ELSE NULLIF({{params.api_key}}::text, '')
        END,
        ship_from_phone = NULLIF({{params.ship_from_phone}}::text, '')
      WHERE id = {{params.id}}::bigint
      RETURNING id
    `,
  });
}

export default updateWarehouseShippo;
