import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Novel Recall',
  version: '0.1.0',
  permissions: ['storage'],
  action: {
    default_title: 'Novel Recall',
    default_popup: 'src/popup/index.html',
  },
  options_page: 'src/options/index.html',
  host_permissions: ['https://api.siliconflow.cn/*'],
})
