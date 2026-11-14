import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import contentPlugin from './content-plugin.ts'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss(), contentPlugin(fileURLToPath(new URL('.', import.meta.url)))],
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'editor', test: /node_modules[\\/](@codemirror|@uiw|@lezer|codemirror|style-mod|w3c-keyname|crelt)/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
})
