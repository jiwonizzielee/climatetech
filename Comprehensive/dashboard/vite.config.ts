import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  // Serve the simulation output/ folder under /data so the dashboard can fetch JSON files
  publicDir: path.resolve(__dirname, '../output'),
})
