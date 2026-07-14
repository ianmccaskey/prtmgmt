import { action } from '@uibakery/data';

function listInboundShipments() {
  return action('listInboundShipments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        si.id, si.reference_number, si.freight_forwarder, si.mode,
        si.tracking_number, si.departure_date, si.arrival_date,
        si.status, si.customs_status, si.hts_code, si.declared_value,
        si.notes, si.is_seed,
        f.name AS factory_name, f.id AS factory_id,
        COUNT(sii.id) AS line_count,
        COALESCE(SUM(sii.quantity_shipped), 0) AS total_shipped,
        COALESCE(SUM(sii.quantity_received), 0) AS total_received,
        COUNT(CASE WHEN sii.condition_flag NOT IN ('ok') AND sii.condition_flag IS NOT NULL THEN 1 END) AS discrepancy_lines
      FROM shipments_inbound si
      LEFT JOIN factories f ON f.id = si.factory_id
      LEFT JOIN shipments_inbound_items sii ON sii.shipment_id = si.id
      WHERE
        (COALESCE({{params.status}}, '') = '' OR si.status = {{params.status}})
        AND (COALESCE({{params.factory_id}}, '') = '' OR si.factory_id::text = {{params.factory_id}})
        AND (COALESCE({{params.mode}}, '') = '' OR si.mode = {{params.mode}})
        AND (COALESCE({{params.search}}, '') = '' OR
             si.reference_number ILIKE {{ '%' + params.search + '%' }} OR
             si.tracking_number ILIKE {{ '%' + params.search + '%' }} OR
             f.name ILIKE {{ '%' + params.search + '%' }})
        AND ({{params.date_from}} IS NULL OR si.arrival_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR si.arrival_date <= {{params.date_to}}::date)
      GROUP BY si.id, f.name, f.id
      ORDER BY si.arrival_date DESC NULLS LAST
    `,
  });
}

export default listInboundShipments;
