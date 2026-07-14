import { action } from '@uibakery/data';
function upsertAppSetting() {
  return action('upsertAppSetting', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ({{params.key}}, {{params.value}}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
  });
}
export default upsertAppSetting;
