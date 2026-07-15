import { action } from '@uibakery/data';

function getShipmentStats() {
  return action('getShipmentStats', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        COUNT(CASE WHEN si.status = 'freight_forwarder' THEN 1 END) AS with_freight_forwarder,
        COUNT(CASE WHEN si.status = 'in_transit' THEN 1 END) AS in_transit,
        COUNT(CASE WHEN si.status = 'delivered' AND si.arrival_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) AS delivered_this_month,
        COUNT(DISTINCT CASE
          WHEN si.arrival_date >= date_trunc('month', CURRENT_DATE)
          AND sii.condition_flag NOT IN ('ok') AND sii.condition_flag IS NOT NULL THEN si.id
        END) AS discrepancies_this_month
      FROM shipments_inbound si
      LEFT JOIN shipments_inbound_items sii ON sii.shipment_id = si.id
    `,
  });
}

export default getShipmentStats;
