import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Prototipo visual de NodeKeeper (Coopelesca). Sin backend.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
