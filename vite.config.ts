import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allows the temporary Manus sandbox preview URL only during local development.
    allowedHosts: ['.manus.computer'],
  },
  build: {
    minify: 'terser',
    terserOptions: {
      format: { comments: false },
    },
    chunkSizeWarningLimit: 1400,
  },
})
