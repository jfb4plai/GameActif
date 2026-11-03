import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : la version construite s'ouvre aussi en file:// (chemins relatifs).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5196, strictPort: true },
});
