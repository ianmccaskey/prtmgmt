import { action } from '@uibakery/data';

function receiveShipmentLine() {
  return action('receiveShipmentLine', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_inbound_items
      SET
        quantity_received = {{params.quantity_received}},
        condition_flag = {{params.condition_flag}},
        discrepancy_notes = {{params.discrepancy_notes}},
        received_at = NOW()
      WHERE id = {{params.item_id}}
    `,
  });
}

export default receiveShipmentLine;
