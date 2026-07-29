/* Servicio de Nodos de red. Mapea 1:1 los endpoints reales de
   backend/src/modules/network-nodes/network-node.routes.js, incluida la ruta
   especial /map usada por la vista de mapa. Sin filtros ni paginacion. */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient.js';

const BASE = '/network-nodes';

/** GET /network-nodes */
export function list() {
  return apiGet(BASE);
}

/** GET /network-nodes/map (nodos con coordenadas para el mapa) */
export function map() {
  return apiGet(`${BASE}/map`);
}

/** GET /network-nodes/:id */
export function getById(id) {
  return apiGet(`${BASE}/${id}`);
}

/** POST /network-nodes (solo ADMIN) */
export function create(payload) {
  return apiPost(BASE, payload);
}

/** PUT /network-nodes/:id (solo ADMIN) */
export function update(id, payload) {
  return apiPut(`${BASE}/${id}`, payload);
}

/** DELETE /network-nodes/:id (solo ADMIN) */
export function remove(id) {
  return apiDelete(`${BASE}/${id}`);
}
