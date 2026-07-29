/* Traduccion de roles reales del backend (ADMIN | OPERATOR) a etiquetas
   visibles en espanol. El resto de la app trabaja SIEMPRE con el valor real
   (ADMIN/OPERATOR); estas etiquetas son solo para presentacion. */

export const ROLE_LABELS = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
};

/** Devuelve la etiqueta en espanol para un rol real; si es desconocido, lo
    devuelve tal cual para no ocultar datos inesperados. */
export function roleLabel(role) {
  return ROLE_LABELS[role] || role || '';
}
