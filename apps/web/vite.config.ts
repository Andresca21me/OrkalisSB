import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + React (FASE-13). El proxy /api evita CORS en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
