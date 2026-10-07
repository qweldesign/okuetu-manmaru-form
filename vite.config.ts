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
  plugins: [
    react(),
    tailwindcss()
  ],
  base: '/form/'
});
