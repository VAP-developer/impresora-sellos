import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Alias Meteor imports to our mocks
      'meteor/meteor': resolve(__dirname, '__mocks__/meteor.ts'),
      'vue-meteor-tracker': resolve(__dirname, '__mocks__/vue-meteor-tracker.ts'),
      'meteor/jalik:ufs': resolve(__dirname, '__mocks__/jalik-ufs.ts'),
      // Alias the collections to stubs
      '../../api/config/collection': resolve(__dirname, '__mocks__/config-collection.ts'),
      '../../api/images/collection': resolve(__dirname, '__mocks__/images-collection.ts'),
      '../../api/images/store': resolve(__dirname, '__mocks__/images-store.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.spec.ts'],
    testTimeout: 30000,
    globals: true,
  },
})
