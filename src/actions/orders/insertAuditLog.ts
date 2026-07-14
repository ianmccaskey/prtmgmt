import { action } from '@uibakery/data';

export function insertAuditLog() {
  return action('insertAuditLog', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO order_audit_log (
        sales_order_id, changed_by_user_id, change_type, field_name, old_value, new_value, note
      ) VALUES (
        {{params.orderId}}::bigint,
        {{params.userId}},
        {{params.changeType}},
        {{params.fieldName}},
        {{params.oldValue}},
        {{params.newValue}},
        {{params.note}}
      )
    `,
  });
}

export default insertAuditLog;
