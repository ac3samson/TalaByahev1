import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 43123,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:43124',
        changeOrigin: true,
      },
    },
  },
});
