import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// resolveBaseUrl lee import.meta.env.VITE_API_URL en tiempo de import; sin
// esa variable definida en el entorno de test, cae al default documentado
// (http://localhost:4000/api), que es lo que se asume en las URLs
// esperadas de estas pruebas.
import {
  ApiError,
  UNAUTHORIZED_EVENT,
  apiDelete,
  apiDownload,
  apiGet,
  apiPatch,
  apiPost,
  apiUpload,
  clearToken,
  getToken,
  setToken,
} from './apiClient.js';

function jsonResponse(body, { ok = true, status = 200, headers = {} } = {}) {
  const headerMap = new Map(Object.entries(headers));
  return {
    ok,
    status,
    headers: { get: (key) => headerMap.get(key) ?? null },
    text: async () => JSON.stringify(body),
  };
}

function emptyResponse({ ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => null },
    text: async () => '',
  };
}

function blobResponse({ blobContent = 'contenido', contentType = 'application/pdf', disposition } = {}) {
  const headers = new Map();
  if (contentType) headers.set('Content-Type', contentType);
  if (disposition) headers.set('Content-Disposition', disposition);
  return {
    ok: true,
    status: 200,
    headers: { get: (key) => headers.get(key) ?? null },
    blob: async () => new Blob([blobContent]),
  };
}

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getToken/setToken/clearToken persisten en localStorage bajo la clave esperada', () => {
    expect(getToken()).toBeNull();
    setToken('fixture-token');
    expect(localStorage.getItem('nodekeeper_token')).toBe('fixture-token');
    expect(getToken()).toBe('fixture-token');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('apiGet devuelve directamente el contenido de data del envelope', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ success: true, message: 'ok', data: { foo: 'bar' } }),
    );

    const result = await apiGet('/network-nodes');

    expect(result).toEqual({ foo: 'bar' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/network-nodes',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('devuelve null cuando la respuesta no trae cuerpo (p. ej. DELETE con data: null)', async () => {
    fetch.mockResolvedValueOnce(emptyResponse());

    const result = await apiDelete('/network-nodes/abc');

    expect(result).toBeNull();
  });

  it('lanza ApiError con status y message cuando la respuesta no es ok', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ success: false, message: 'Network node not found' }, { ok: false, status: 404 }),
    );

    await expect(apiGet('/network-nodes/no-existe')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Network node not found',
    });
  });

  it('propaga errors[] de validacion (400) dentro de ApiError', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse(
        { success: false, message: 'Validation failed', errors: [{ path: 'email', message: 'Invalid email format' }] },
        { ok: false, status: 400 },
      ),
    );

    try {
      await apiPost('/users', { email: 'no-valido' });
      expect.unreachable('debio lanzar ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(400);
      expect(err.errors).toEqual([{ path: 'email', message: 'Invalid email format' }]);
    }
  });

  it('convierte un fallo de red en ApiError con status 0', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiGet('/network-nodes')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: 'No se pudo conectar con el servidor. Verifica tu conexion.',
    });
  });

  it('ante un 401: limpia el token y emite el evento global de sesion expirada', async () => {
    setToken('token-por-expirar');
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    fetch.mockResolvedValueOnce(
      jsonResponse({ success: false, message: 'Unauthorized' }, { ok: false, status: 401 }),
    );

    await expect(apiGet('/auth/me')).rejects.toMatchObject({ status: 401 });

    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it('apiUpload (multipart) NO establece Content-Type manualmente', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: { evidence: { id: 'e1' } } }));

    const formData = new FormData();
    formData.append('file', new Blob(['contenido']), 'evidencia.jpg');

    await apiUpload('/maintenances/m1/evidences', formData);

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body).toBe(formData);
  });

  it('apiPatch envia JSON con Content-Type application/json', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: { user: { id: 'u1' } } }));

    await apiPatch('/users/u1/status', { isActive: false });

    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe('PATCH');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ isActive: false });
  });

  it('apiDownload resuelve blob, filename (desde Content-Disposition UTF-8) y contentType', async () => {
    fetch.mockResolvedValueOnce(
      blobResponse({
        contentType: 'application/pdf',
        disposition: "attachment; filename=\"evidencia.pdf\"; filename*=UTF-8''informe%20t%C3%A9cnico.pdf",
      }),
    );

    const result = await apiDownload('/maintenances/m1/evidences/e1/file');

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.contentType).toBe('application/pdf');
    expect(result.filename).toBe('informe técnico.pdf');
  });

  it('apiDownload usa el fallback ASCII si no hay variante UTF-8', async () => {
    fetch.mockResolvedValueOnce(
      blobResponse({ disposition: 'inline; filename="foto.jpg"' }),
    );

    const result = await apiDownload('/maintenances/m1/evidences/e1/file');

    expect(result.filename).toBe('foto.jpg');
  });
});
