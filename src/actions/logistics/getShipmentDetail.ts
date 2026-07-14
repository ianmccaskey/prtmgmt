import { action } from '@uibakery/data';

function getShipmentDetail() {
  return action('getShipmentDetail', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        si.id, si.reference_number, si.freight_forwarder, si.mode,
        si.tracking_number, si.departure_date, si.arrival_date,
        si.status, si.customs_status, si.hts_code, si.declared_value, si.notes,
        f.name AS factory_name, f.id AS factory_id
      FROM shipments_inbound si
      LEFT JOIN factories f ON f.id = si.factory_id
      WHERE si.id = {{params.id}}
    `,
  });
}

export default getShipmentDetail;
