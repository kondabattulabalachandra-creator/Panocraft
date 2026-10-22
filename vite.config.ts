import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Panocraft/',
  server: { allowedHosts: ['.sg2.manus.computer'] },
  build: { outDir: 'dist', sourcemap: false }
});
