import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Recall',
  version: '0.1.0',
  permissions: ['activeTab', 'scripting'],
  action: {
    default_title: 'Recall',
    default_popup: 'src/popup/index.html',
  },
})
