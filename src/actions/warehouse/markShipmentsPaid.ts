import { action } from '@uibakery/data';

function markShipmentsPaid() {
  return action('markShipmentsPaid', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE shipments_outbound
      SET payable_status = 'paid', paid_at = NOW(), paid_by_user_id = {{params.user_id}}
      WHERE id = ANY({{params.shipment_ids}}::bigint[])
    `,
  });
}

export default markShipmentsPaid;
