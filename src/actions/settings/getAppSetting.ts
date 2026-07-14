import { action } from '@uibakery/data';
function getAppSetting() {
  return action('getAppSetting', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `SELECT key, value, updated_at FROM app_settings WHERE key = {{params.key}}`,
  });
}
export default getAppSetting;
