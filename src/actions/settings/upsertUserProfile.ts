import { action } from '@uibakery/data';
function upsertUserProfile() {
  return action('upsertUserProfile', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO user_profiles (user_id, display_name, role, assigned_warehouse_id, updated_at)
      VALUES ({{params.user_id}}, {{params.display_name}}, {{params.role}}, {{params.assigned_warehouse_id}}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        assigned_warehouse_id = EXCLUDED.assigned_warehouse_id,
        updated_at = NOW()
      RETURNING id
    `,
  });
}
export default upsertUserProfile;
