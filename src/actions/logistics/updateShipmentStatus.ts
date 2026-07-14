import { action } from '@uibakery/data';

function updateShipmentStatus() {
  return action('updateShipmentStatus', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_inbound
      SET status = {{params.status}},
          customs_status = COALESCE({{params.customs_status}}, customs_status),
          tracking_number = COALESCE({{params.tracking_number}}, tracking_number),
          notes = COALESCE({{params.notes}}, notes)
      WHERE id = {{params.id}}
      RETURNING id, status
    `,
  });
}

export default updateShipmentStatus;
