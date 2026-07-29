/* Hook de lectura asincrona para pantallas que consumen la API. Encapsula el
   ciclo data/error/loading + reload, y protege contra actualizaciones de
   estado despues de desmontar (o despues de un reload que reemplaza a una
   peticion aun en vuelo) mediante un contador de ejecucion.

   Uso:
     const { data, error, loading, reload } = useAsync(
       () => networkNodeService.list(),
       [],            // dependencias que disparan una nueva carga
       { immediate: true },
     );

   `asyncFn` debe devolver una promesa. Se recomienda envolverla en useCallback
   en el llamador si captura props/estado, para controlar cuando recargar. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync(asyncFn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);

  const mountedRef = useRef(true);
  // Identifica la ejecucion vigente: si llega una respuesta de una ejecucion
  // anterior (porque se llamo reload de nuevo), se descarta.
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const runId = ++runIdRef.current;
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await asyncFn();
      if (mountedRef.current && runId === runIdRef.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (mountedRef.current && runId === runIdRef.current) {
        setError(err);
      }
      return undefined;
    } finally {
      if (mountedRef.current && runId === runIdRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return { data, error, loading, reload: run };
}
