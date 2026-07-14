import { action } from '@uibakery/data';
function updateUserProfileById() {
  return action('updateUserProfileById', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      UPDATE user_profiles SET
        email = {{params.email}},
        display_name = {{params.display_name}},
        role = {{params.role}},
        assigned_warehouse_id = {{params.assigned_warehouse_id}},
        avatar_file = CASE WHEN {{params.avatar_file}} = '__CLEAR__' THEN NULL
                           ELSE COALESCE({{params.avatar_file}}, avatar_file) END,
        updated_at = NOW()
      WHERE id = {{params.id}}
      RETURNING id
    `,
  });
}
export default updateUserProfileById;
