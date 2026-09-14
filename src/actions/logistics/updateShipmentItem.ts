import { action } from '@uibakery/data';

/**
 * Edit an inbound shipment line BEFORE receipt: quantity shipped and the
 * expected-arrival override. Refuses (0 rows) once the line has been
 * received — received rows are inventory history, corrected only through
 * the receiving/count-correction flows.
 */
function updateShipmentItem() {
  return action('updateShipmentItem', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_inbound_items
      SET quantity_shipped = {{params.quantity_shipped}}::int,
          expected_arrival_date = NULLIF({{params.expected_arrival_date}}, '')::date
      WHERE id = {{params.id}}::bigint
        AND quantity_received IS NULL
        AND {{params.quantity_shipped}}::int > 0
      RETURNING id
    `,
  });
}

export default updateShipmentItem;
