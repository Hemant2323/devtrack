import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned: the backend's CORS allowlist contains only http://localhost:5173.
  // strictPort makes a port collision fail loudly instead of silently moving
  // to 5174, where every API call would be blocked by CORS.
  server: { port: 5173, strictPort: true },
})
