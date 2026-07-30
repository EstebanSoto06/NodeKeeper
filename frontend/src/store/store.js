/* Store en memoria para notificaciones (toast) globales.
   Modal.jsx (ToastHost) y las pantallas conectadas a la API real usan este
   store únicamente para mostrar/descartar mensajes de éxito o error tras una
   mutación (showToast/dismissToast), vía useSyncExternalStore. */
import { useSyncExternalStore } from 'react';

let state = {
  toast: null,
};

const listeners = new Set();
let toastTimer = null;

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return state; }

export function useStore() { return useSyncExternalStore(subscribe, getSnapshot); }

export function showToast(message, kind = 'success') {
  if (toastTimer) clearTimeout(toastTimer);
  state.toast = { message, kind, id: Date.now() };
  emit();
  toastTimer = setTimeout(() => { state.toast = null; emit(); }, 4200);
}
export function dismissToast() {
  if (toastTimer) clearTimeout(toastTimer);
  state.toast = null;
  emit();
}
