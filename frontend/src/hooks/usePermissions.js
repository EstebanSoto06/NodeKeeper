/* Deriva los permisos de la UI a partir del rol real del usuario en sesion
   (ADMIN | OPERATOR) y, cuando aplica, del estado del mantenimiento. Estos
   flags son un ESPEJO de lo que el backend ya valida (ver las rutas de cada
   modulo): sirven para no mostrar acciones imposibles, NUNCA como sustituto
   de la validacion real del servidor.

   Reglas reflejadas del backend:
   - Gestion (crear/editar/eliminar) de proveedores, nodos, equipos y
     mantenimientos: solo ADMIN.
   - Consulta de todo lo anterior: ADMIN y OPERATOR.
   - Iniciar/completar mantenimiento: ADMIN y OPERATOR.
   - Checklist: crear/editar/eliminar solo ADMIN; cambiar estado ADMIN y
     OPERATOR.
   - Evidencias: listar/subir/descargar ADMIN y OPERATOR; eliminar solo ADMIN.
     Ademas, subir/eliminar requiere que el mantenimiento este IN_PROGRESS. */
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { canManageEvidence, canManageChecklist } from '../utils/maintenanceState.js';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  return useMemo(() => {
    const isAdmin = role === 'ADMIN';
    const isOperator = role === 'OPERATOR';
    const isAuthenticated = isAdmin || isOperator;

    return {
      role,
      isAdmin,
      isOperator,

      // Gestion de catalogos (solo ADMIN)
      canManageProviders: isAdmin,
      canManageNodes: isAdmin,
      canManageEquipment: isAdmin,
      canManageMaintenances: isAdmin,

      // Consulta general (cualquier usuario autenticado)
      canViewCatalogs: isAuthenticated,

      // Flujo de mantenimiento (ADMIN u OPERATOR)
      canRunMaintenanceFlow: isAuthenticated,

      // Checklist
      canEditChecklist: isAdmin,
      canToggleChecklist: isAuthenticated,

      // Evidencias
      canUploadEvidence: isAuthenticated,
      canDeleteEvidence: isAdmin,

      /* Helpers dependientes del estado del mantenimiento: combinan el rol con
         la regla de estado (IN_PROGRESS) que el backend tambien exige. */
      canUploadEvidenceFor(status) {
        return isAuthenticated && canManageEvidence(status);
      },
      canDeleteEvidenceFor(status) {
        return isAdmin && canManageEvidence(status);
      },
      canEditChecklistFor(status) {
        return isAdmin && canManageChecklist(status);
      },
    };
  }, [role]);
}
