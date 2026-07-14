import { action } from '@uibakery/data';
function getMyProfile() {
  return action('getMyProfile', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        up.id, up.user_id, up.email, up.role, up.assigned_warehouse_id,
        up.display_name, up.avatar_file,
        w.name AS assigned_warehouse_name,
        (SELECT COUNT(*) FROM user_profiles WHERE email IS NOT NULL) AS provisioned_count
      FROM (SELECT 1) AS one
      LEFT JOIN user_profiles up ON LOWER(up.email) = LOWER({{params.email}})
      LEFT JOIN warehouses w ON w.id = up.assigned_warehouse_id
      LIMIT 1
    `,
  });
}
export default getMyProfile;
