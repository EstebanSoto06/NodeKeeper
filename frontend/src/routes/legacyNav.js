/* Puente de compatibilidad para las 14 pantallas del prototipo, que ya
   esperan navegar entre si con la firma go(view, id) y comparar el rol en
   formato 'admin'|'operator' (minuscula). Esta fase (Base + Autenticacion)
   no reescribe esas pantallas -- solo agrega el ruteo real por debajo -- asi
   que este modulo traduce esa firma legada a navegacion real de
   react-router-dom, y normaliza el rol real del backend (ADMIN/OPERATOR) al
   formato que esas pantallas ya usan. Se retira cuando cada pantalla se
   reescriba para consumir rutas y roles reales directamente. */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const VIEW_TO_PATH = {
  dashboard: () => '/dashboard',
  nodes: () => '/nodos',
  'node-detail': (id) => `/nodos/${id}`,
  equipment: () => '/equipos',
  'equipment-detail': (id) => `/equipos/${id}`,
  providers: () => '/proveedores',
  'provider-detail': (id) => `/proveedores/${id}`,
  maintenances: () => '/mantenimientos',
  'maint-detail': (id) => `/mantenimientos/${id}`,
  calendar: () => '/calendario',
  map: () => '/mapa',
  evidence: () => '/evidencias',
  reports: () => '/reportes',
  users: () => '/usuarios',
};

export function useLegacyGo() {
  const navigate = useNavigate();
  return (view, id) => {
    const toPath = VIEW_TO_PATH[view];
    if (!toPath) {
      console.warn(`useLegacyGo: vista desconocida "${view}"`);
      return;
    }
    navigate(toPath(id));
  };
}

export function useLegacyRole() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? 'admin' : 'operator';
}
