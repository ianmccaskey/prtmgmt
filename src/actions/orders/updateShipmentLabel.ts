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
      WITH old AS (
        SELECT id, sales_order_id, label_url FROM shipments_outbound
        WHERE id = {{params.shipment_id}}::bigint
      ),
      upd AS (
        UPDATE shipments_outbound so SET label_url = {{params.label_url}}
        FROM old
        WHERE so.id = old.id
          -- Scheme allowlist: label_url renders into an href, so only
          -- web URLs and the upload component's own data: types may land
          -- here (a stored javascript: URL would be a clickable payload).
          AND ({{params.label_url}} LIKE 'https://%'
            OR {{params.label_url}} LIKE 'http://%'
            OR {{params.label_url}} LIKE 'data:application/pdf%'
            OR {{params.label_url}} LIKE 'data:image/%')
        RETURNING so.id
      )
      INSERT INTO order_audit_log (sales_order_id, changed_by_user_id, changed_at, change_type, field_name, old_value, new_value, note)
      SELECT old.sales_order_id, {{params.userId}}::bigint, NOW(), 'other', 'shipment_label',
        LEFT(COALESCE(old.label_url, ''), 200), LEFT({{params.label_url}}, 200), {{params.note}}
      FROM old WHERE EXISTS (SELECT 1 FROM upd)
      RETURNING sales_order_id
    `,
  });
}

export default updateShipmentLabel;
