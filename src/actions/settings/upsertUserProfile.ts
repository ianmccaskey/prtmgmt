import { action } from '@uibakery/data';
function upsertUserProfile() {
  return action('upsertUserProfile', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO user_profiles (user_id, email, display_name, role, assigned_warehouse_id, commission_rate, division, updated_at)
      VALUES ({{params.user_id}}, {{params.email}}, {{params.display_name}}, {{params.role}}, {{params.assigned_warehouse_id}},
              COALESCE(NULLIF({{params.commission_rate}}, '')::numeric, 0.10),
              COALESCE(NULLIF({{params.division}}, ''), 'us'), NOW())
      ON CONFLICT (LOWER(email)) WHERE email IS NOT NULL DO UPDATE SET
        user_id = COALESCE(EXCLUDED.user_id, user_profiles.user_id),
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        assigned_warehouse_id = EXCLUDED.assigned_warehouse_id,
        commission_rate = COALESCE(NULLIF({{params.commission_rate}}, '')::numeric, user_profiles.commission_rate),
        division = COALESCE(NULLIF({{params.division}}, ''), user_profiles.division),
        updated_at = NOW()
      RETURNING id
    `,
  });
}
export default upsertUserProfile;
