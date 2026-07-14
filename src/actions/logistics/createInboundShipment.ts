import { action } from '@uibakery/data';

function createInboundShipment() {
  return action('createInboundShipment', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO shipments_inbound (
        reference_number, factory_id, freight_forwarder, mode, tracking_number,
        departure_date, arrival_date, status, customs_status, hts_code,
        declared_value, notes
      ) VALUES (
        {{params.reference_number}}, {{params.factory_id}}, {{params.freight_forwarder}},
        {{params.mode}}, {{params.tracking_number}},
        {{params.departure_date}}, {{params.arrival_date}},
        'pending', {{params.customs_status}}, {{params.hts_code}},
        {{params.declared_value}}, {{params.notes}}
      ) RETURNING id, reference_number
    `,
  });
}

export default createInboundShipment;
