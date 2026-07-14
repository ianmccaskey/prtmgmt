import { action } from '@uibakery/data';
function listUserProfiles() {
  return action('listUserProfiles', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        up.id, up.user_id, up.role, up.assigned_warehouse_id,
        up.display_name, up.avatar_file, up.created_at, up.updated_at,
        w.name AS assigned_warehouse_name
      FROM user_profiles up
      LEFT JOIN warehouses w ON w.id = up.assigned_warehouse_id
      ORDER BY up.display_name ASC
    `,
  });
}
export default listUserProfiles;
