/* Cliente HTTP unico sobre fetch nativo (sin axios). Centraliza:
   - la URL base (VITE_API_URL, que YA incluye el sufijo /api);
   - el header Authorization con el token persistido;
   - el parseo del envelope estandar del backend
     ({ success, message, data } / { success, message, errors });
   - descargas binarias (blob) con su nombre sugerido (Content-Disposition);
   - la senal global de sesion expirada (401), para que AuthContext reaccione
     sin que este modulo dependa de React.

   Convencion de rutas: los servicios pasan rutas SIN el prefijo /api
   (p. ej. '/auth/login', '/network-nodes'), porque la base ya lo incluye. */

// La base por defecto incluye /api a proposito: es la unica convencion.
// En despliegue se sobreescribe con VITE_API_URL (ver frontend/.env.example).
const DEFAULT_BASE_URL = 'http://localhost:4000/api';
const TOKEN_STORAGE_KEY = 'nodekeeper_token';
export const UNAUTHORIZED_EVENT = 'nodekeeper:unauthorized';

function resolveBaseUrl() {
  return import.meta.env.VITE_API_URL || DEFAULT_BASE_URL;
}

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || [];
  }
}

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Extrae el nombre de archivo sugerido del header Content-Disposition.
// El backend envia una variante ASCII (filename=) y otra UTF-8 (filename*=);
// se prefiere la UTF-8 cuando esta disponible. Si no hay header o no se puede
// interpretar, se devuelve null y el llamador decide un nombre por defecto.
function parseFilenameFromDisposition(disposition) {
  if (!disposition) return null;

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // cae al fallback ASCII
    }
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return asciiMatch?.[1] || null;
}

function buildHeaders(body, isMultipart) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  // En multipart NO se fija Content-Type: el navegador agrega el boundary.
  if (body !== undefined && !isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function handleUnauthorized(status) {
  if (status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

async function throwFromResponse(response) {
  const payload = await parseJsonSafely(response);
  const message = payload?.message || 'Ocurrio un error inesperado.';
  throw new ApiError(message, {
    status: response.status,
    errors: payload?.errors,
  });
}

/**
 * Llamada JSON estandar. Devuelve directamente `data` del envelope (o null si
 * la respuesta no trae cuerpo, p. ej. un DELETE con data: null). Lanza
 * ApiError en cualquier respuesta no-ok, en errores de red (status 0) y de
 * validacion (con `errors` poblado).
 *
 * @param {string} path  ruta sin /api (la base ya lo incluye)
 */
export async function request(path, { method = 'GET', body, isMultipart = false } = {}) {
  const url = `${resolveBaseUrl()}${path}`;
  const headers = buildHeaders(body, isMultipart);

  let requestBody;
  if (body !== undefined) {
    requestBody = isMultipart ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body: requestBody });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica tu conexion.', {
      status: 0,
    });
  }

  handleUnauthorized(response.status);

  if (!response.ok) {
    await throwFromResponse(response);
  }

  const payload = await parseJsonSafely(response);
  return payload?.data ?? null;
}

/**
 * Descarga binaria autenticada. Devuelve { blob, filename, contentType } para
 * que el llamador arme un enlace de descarga. Nunca expone rutas fisicas del
 * servidor: el nombre proviene del header Content-Disposition.
 *
 * @param {string} path  ruta sin /api (la base ya lo incluye)
 */
export async function requestBlob(path, { method = 'GET' } = {}) {
  const url = `${resolveBaseUrl()}${path}`;
  const headers = buildHeaders();

  let response;
  try {
    response = await fetch(url, { method, headers });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica tu conexion.', {
      status: 0,
    });
  }

  handleUnauthorized(response.status);

  if (!response.ok) {
    await throwFromResponse(response);
  }

  const blob = await response.blob();
  const filename = parseFilenameFromDisposition(
    response.headers.get('Content-Disposition'),
  );
  const contentType = response.headers.get('Content-Type');

  return { blob, filename, contentType };
}

/* Atajos por metodo HTTP. Solo se exponen los verbos que el backend usa
   realmente (GET, POST, PATCH, PUT, DELETE). */
export const apiGet = (path) => request(path);
export const apiPost = (path, body) => request(path, { method: 'POST', body });
export const apiPatch = (path, body) => request(path, { method: 'PATCH', body });
export const apiPut = (path, body) => request(path, { method: 'PUT', body });
export const apiDelete = (path) => request(path, { method: 'DELETE' });

/** POST multipart/form-data (cargas de archivos). `formData` es un FormData. */
export const apiUpload = (path, formData) =>
  request(path, { method: 'POST', body: formData, isMultipart: true });

/** GET binario autenticado -> { blob, filename, contentType }. */
export const apiDownload = (path) => requestBlob(path);
