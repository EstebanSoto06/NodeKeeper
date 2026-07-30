/* Setup global de Vitest para el frontend. Se ejecuta una vez antes de la
   suite (via test.setupFiles en vite.config.js). */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Limpieza automatica del DOM entre pruebas (equivalente a lo que hacen los
// presets de Jest por defecto; con Vitest hay que registrarlo a mano).
afterEach(() => {
  cleanup();
});
