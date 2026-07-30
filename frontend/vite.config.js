import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// NodeKeeper (Coopelesca). La config de produccion (plugins/server) no
// cambia: `test` es una clave adicional que `vite build`/`vite dev` ignoran
// por completo; solo la usa Vitest.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setupTests.js'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // No confirmar el reporte de cobertura al repo (ver .gitignore).
      reportsDirectory: './coverage',
      thresholds: {
        lines: 55,
        statements: 55,
        functions: 55,
        branches: 45,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/main.jsx',
        'src/styles/**',
        'src/test/**',
        'vite.config.js',
        'postcss.config.js',
        'tailwind.config.js',
        '**/*.config.js',
      ],
    },
  },
});
