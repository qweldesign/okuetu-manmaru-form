import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
    output: {
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      }
    },
  },
  server: {
    // api/ の PHP は、PHP の開発サーバー（npm run dev:api）に中継する
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  base: '/form/'
});
