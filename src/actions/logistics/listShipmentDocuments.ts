import { action } from '@uibakery/data';

function listShipmentDocuments() {
  return action('listShipmentDocuments', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        sd.id, sd.shipment_id, sd.doc_type, sd.label, sd.doc_url, sd.doc_file,
        sd.created_at,
        up.display_name AS created_by_name
      FROM shipment_documents sd
      LEFT JOIN user_profiles up ON up.id = sd.created_by_user_id
      WHERE sd.shipment_id = {{params.shipment_id}}
      ORDER BY sd.created_at DESC
    `,
  });
}

export default listShipmentDocuments;
