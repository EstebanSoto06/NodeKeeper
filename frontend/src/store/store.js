/* Store en memoria para el módulo de Proveedores.
   El prototipo no tiene backend: este store mantiene los proveedores y la
   asignación equipo→proveedor en memoria, y notifica a los componentes
   suscritos (vía useSyncExternalStore). Al recargar la página se reinicia.

   Reglas reflejadas:
   - Cada equipo tiene como máximo un proveedor (supportProviderId) y es opcional.
   - Un proveedor puede estar asociado a varios equipos.
   - Al eliminar un proveedor, sus equipos pasan a `null` ("No asignado").
   Toda mutación sigue siendo mock (no persiste ni llama a una API). */
import { useSyncExternalStore } from 'react';
import { DATA } from '../data/mockData.js';

let state = {
  providers: DATA.providers.map((p) => ({ ...p })),
  // Asignación equipo→proveedor (clave: id de equipo, valor: id de proveedor | null)
  assign: Object.fromEntries(DATA.equipment.map((e) => [e.id, e.supportProviderId ?? null])),
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

/* ---- Lecturas derivadas ---- */
export function providerById(id) { return state.providers.find((p) => p.id === id) || null; }
export function providerOfEquipment(eqId) { return providerById(state.assign[eqId]); }
export function equipmentIdsForProvider(provId) {
  return Object.keys(state.assign).filter((eqId) => state.assign[eqId] === provId);
}
export function equipmentCountForProvider(provId) { return equipmentIdsForProvider(provId).length; }

/* ---- Mutaciones (mock en memoria) ---- */
function nextProviderId() {
  const nums = state.providers.map((p) => parseInt(p.id.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return 'PROV-' + String(n).padStart(3, '0');
}

export function addProvider(data) {
  const prov = { id: nextProviderId(), ...data };
  state.providers = [...state.providers, prov];
  emit();
  showToast('Proveedor creado correctamente.');
  return prov;
}

export function updateProvider(id, data) {
  state.providers = state.providers.map((p) => (p.id === id ? { ...p, ...data } : p));
  emit();
  showToast('Proveedor actualizado correctamente.');
}

export function removeProvider(id) {
  const affected = equipmentIdsForProvider(id);
  // Equipos asociados pasan a "No asignado" (null). No se eliminan equipos.
  const assign = { ...state.assign };
  affected.forEach((eqId) => { assign[eqId] = null; });
  state.assign = assign;
  state.providers = state.providers.filter((p) => p.id !== id);
  emit();
  showToast(affected.length
    ? 'Proveedor eliminado. Los equipos asociados quedaron sin proveedor asignado.'
    : 'Proveedor eliminado.');
}

export function setEquipmentProvider(eqId, providerId) {
  state.assign = { ...state.assign, [eqId]: providerId || null };
  emit();
}

/* ---- Toast ---- */
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
