import { action } from '@uibakery/data';

function createShipmentDocument() {
  return action('createShipmentDocument', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO shipment_documents (
        shipment_id, doc_type, label, doc_url, created_at, created_by_user_id
      ) VALUES (
        {{params.shipment_id}}, {{params.doc_type}}, {{params.label}},
        {{params.doc_url}}, NOW(), {{params.user_id}}
      ) RETURNING id
    `,
  });
}

export default createShipmentDocument;
