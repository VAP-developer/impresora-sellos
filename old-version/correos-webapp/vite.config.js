import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(),
  ],

  optimizeDeps: {
    exclude: [],
  },

  meteor: {
    clientEntry: 'imports/ui/main.ts',
  },
})
