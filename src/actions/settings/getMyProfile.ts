import { action } from '@uibakery/data';
function getMyProfile() {
  return action('getMyProfile', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        up.id, up.user_id, up.email, up.role, up.assigned_warehouse_id,
        up.display_name, up.avatar_file,
        w.name AS assigned_warehouse_name
      FROM user_profiles up
      LEFT JOIN warehouses w ON w.id = up.assigned_warehouse_id
      WHERE LOWER(up.email) = LOWER({{params.email}})
      LIMIT 1
    `,
  });
}
export default getMyProfile;
