/* Contexto de autenticacion: unico lugar que toca localStorage (via
   apiClient) y que sabe como iniciar/cerrar sesion. Al montar, si hay un
   token guardado, revalida contra GET /auth/me para recuperar la sesion tras
   un F5; si el token ya no es valido, se limpia y el usuario vuelve a /login.
   Escucha el evento global de 401 (emitido por apiClient) para forzar logout
   automatico ante cualquier llamada que descubra que la sesion expiro.

   Expone: user, token, isAuthenticated, isLoading, login, logout,
   refreshSession. El rol se conserva tal cual llega del backend
   (ADMIN | OPERATOR); la normalizacion a etiqueta visible se hace fuera
   (utils/roleLabels, hooks/usePermissions). */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../services/apiClient.js';
import { getCurrentUser, login as loginRequest } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  const [isLoading, setIsLoading] = useState(true);

  // Evita actualizar estado despues de desmontar (o tras un logout que ocurra
  // mientras una revalidacion sigue en vuelo).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Revalida la sesion contra GET /auth/me usando el token persistido.
  // Se reutiliza en el arranque (F5) y en refreshSession().
  const refreshSession = useCallback(async () => {
    const storedToken = getToken();
    if (!storedToken) {
      if (mountedRef.current) {
        setUser(null);
        setTokenState(null);
        setIsLoading(false);
      }
      return null;
    }

    try {
      const currentUser = await getCurrentUser();
      if (mountedRef.current) {
        setUser(currentUser);
        setTokenState(storedToken);
      }
      return currentUser;
    } catch {
      clearToken();
      if (mountedRef.current) {
        setUser(null);
        setTokenState(null);
      }
      return null;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    function onUnauthorized() {
      if (mountedRef.current) {
        setUser(null);
        setTokenState(null);
      }
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: loggedInUser, token: newToken } = await loginRequest(email, password);
    setToken(newToken);
    if (mountedRef.current) {
      setUser(loggedInUser);
      setTokenState(newToken);
    }
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    if (mountedRef.current) {
      setUser(null);
      setTokenState(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      refreshSession,
    }),
    [user, token, isLoading, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
