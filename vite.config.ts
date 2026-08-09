import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Custom domain (vr.harithkavish.com) is served from the repo root, so base stays '/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: true,
  },
});
