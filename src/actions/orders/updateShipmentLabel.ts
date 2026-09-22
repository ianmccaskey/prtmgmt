import { action } from '@uibakery/data';

/**
 * Replace an outbound shipment's label file (re-bought label, corrected
 * tracking, wrong label uploaded). The Shippo transaction id and internal
 * cost are deliberately KEPT — they record the original purchase; only
 * the label document changes. Audit-logged with a required reason.
 */
function updateShipmentLabel() {
  return action('updateShipmentLabel', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      WITH upd AS (
        UPDATE shipments_outbound SET label_url = {{params.label_url}}
        WHERE id = {{params.shipment_id}}::bigint
        RETURNING id, sales_order_id
      )
      INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, changed_at, change_type, field_name, old_value, new_value, note)
      SELECT u.sales_order_id, {{params.userId}}::bigint, NOW(), 'other', 'shipment_label', NULL, NULL, {{params.note}}
      FROM upd u
      RETURNING sales_order_id
    `,
  });
}

export default updateShipmentLabel;
