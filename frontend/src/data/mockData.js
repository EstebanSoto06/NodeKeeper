/* NodeKeeper · Coopelesca — datos mock (es-CR). Sin datos reales/sensibles.
   Contexto: Zona Norte, cantón de San Carlos, Costa Rica.
   Toda la app es visual: estos datos sustituyen a cualquier backend.
   `DATA` = entidades · `NK` = helpers de estado/color + cálculo de avance. */

export const DATA = {
  nodes: [
    { id: 'n1', code: 'NODE-001', name: 'Subestación Ciudad Quesada', city: 'San Carlos', locality: 'Quesada',      health: 'red',   pending: 3, equip: 8,  x: 30, y: 22 },
    { id: 'n2', code: 'NODE-014', name: 'Nodo Aguas Zarcas',          city: 'San Carlos', locality: 'Aguas Zarcas', health: 'amber', pending: 0, equip: 5,  x: 52, y: 40 },
    { id: 'n3', code: 'NODE-027', name: 'Repetidora Cerro Chato',     city: 'San Carlos', locality: 'La Fortuna',   health: 'green', pending: 0, equip: 3,  x: 68, y: 30 },
    { id: 'n4', code: 'NODE-008', name: 'Nodo Industrial Florencia',  city: 'San Carlos', locality: 'Florencia',    health: 'red',   pending: 2, equip: 11, x: 40, y: 64 },
    { id: 'n5', code: 'NODE-019', name: 'Subestación Pital',          city: 'San Carlos', locality: 'Pital',        health: 'green', pending: 0, equip: 6,  x: 58, y: 18 },
    { id: 'n6', code: 'NODE-033', name: 'Nodo Venecia',               city: 'San Carlos', locality: 'Venecia',      health: 'amber', pending: 0, equip: 7,  x: 74, y: 58 },
    { id: 'n7', code: 'NODE-005', name: 'Repetidora Muelle',          city: 'San Carlos', locality: 'Muelle',       health: 'green', pending: 0, equip: 4,  x: 22, y: 50 },
    { id: 'n8', code: 'NODE-041', name: 'Nodo Río Cuarto',            city: 'Grecia',     locality: 'Río Cuarto',   health: 'amber', pending: 0, equip: 9,  x: 84, y: 38 },
  ],

  /* `supportProviderId`: proveedor de soporte asociado (opcional, máx. 1 por
     equipo). `null` = sin proveedor → la UI muestra "No asignado". */
  equipment: [
    // NODE-001 · Subestación Ciudad Quesada
    { id: 'e1',  nodeId: 'n1', code: 'EQ-118', name: 'Switch core',         type: 'Red',        status: 'operativo', supportProviderId: 'PROV-002' },
    { id: 'e2',  nodeId: 'n1', code: 'EQ-204', name: 'UPS 6kVA',            type: 'Energía',    status: 'alerta',    supportProviderId: 'PROV-003' },
    { id: 'e3',  nodeId: 'n1', code: 'EQ-119', name: 'Aire acondicionado',  type: 'Clima',      status: 'operativo', supportProviderId: null },
    { id: 'e4',  nodeId: 'n1', code: 'EQ-120', name: 'Rack principal',      type: 'Estructura', status: 'operativo', supportProviderId: null },
    { id: 'e5',  nodeId: 'n1', code: 'EQ-331', name: 'Generador diésel',    type: 'Energía',    status: 'falla',     supportProviderId: 'PROV-003' },
    // NODE-008 · Nodo Industrial Florencia
    { id: 'e6',  nodeId: 'n4', code: 'EQ-405', name: 'Generador diésel',    type: 'Energía',    status: 'falla',     supportProviderId: 'PROV-003' },
    { id: 'e7',  nodeId: 'n4', code: 'EQ-406', name: 'Transformador 75kVA', type: 'Energía',    status: 'operativo', supportProviderId: 'PROV-001' },
    { id: 'e8',  nodeId: 'n4', code: 'EQ-407', name: 'Switch distribución', type: 'Red',        status: 'alerta',    supportProviderId: 'PROV-002' },
    // NODE-014 · Nodo Aguas Zarcas
    { id: 'e9',  nodeId: 'n2', code: 'EQ-210', name: 'UPS 3kVA',            type: 'Energía',    status: 'operativo', supportProviderId: 'PROV-003' },
    { id: 'e10', nodeId: 'n2', code: 'EQ-211', name: 'Router perimetral',   type: 'Red',        status: 'operativo', supportProviderId: 'PROV-002' },
    // NODE-019 · Subestación Pital
    { id: 'e11', nodeId: 'n5', code: 'EQ-150', name: 'UPS 6kVA',            type: 'Energía',    status: 'operativo', supportProviderId: null },
    { id: 'e12', nodeId: 'n5', code: 'EQ-151', name: 'Climatización rack',  type: 'Clima',      status: 'operativo', supportProviderId: 'PROV-001' },
  ],

  /* Proveedores de soporte (catálogo). Un proveedor puede dar soporte a varios
     equipos. Solo el Administrador los crea/edita/elimina. Datos ficticios. */
  providers: [
    { id: 'PROV-001', companyName: 'Soporte Técnico del Norte', contactName: 'Carlos Rodríguez',  contactPhone: '8888-1111', contactEmail: 'carlos.rodriguez@stnorte.example', supportPhone: '800-555-0101', supportEmail: 'soporte@stnorte.example' },
    { id: 'PROV-002', companyName: 'RedCom Servicios',          contactName: 'María Fernández',   contactPhone: '8712-4456', contactEmail: 'maria.fernandez@redcom.example',  supportPhone: '4000-2020',    supportEmail: 'ayuda@redcom.example' },
    { id: 'PROV-003', companyName: 'Energía y Respaldo CR',     contactName: 'Luis Jiménez',      contactPhone: '8990-7788', contactEmail: 'luis.jimenez@energiacr.example',      supportPhone: '800-372-6437', supportEmail: 'soporte@energiacr.example' },
  ],

  maint: [
    { id: 'm1', code: 'MNT-2041', nodeId: 'n1', node: 'Subestación Ciudad Quesada', type: 'preventivo', state: 'progreso',  resp: 'Adriana Vargas', date: '2026-06-04', equip: 'Switch core',     recurring: true,  priority: 'alta',  exec: 'interno',
      tasks: [
        { label: 'Inspección visual del gabinete', done: true },
        { label: 'Limpieza de filtros de ventilación', done: true },
        { label: 'Verificación de conexiones de energía', done: true },
        { label: 'Medición de voltaje de entrada', done: false },
        { label: 'Prueba de respaldo UPS', done: false },
        { label: 'Registro de temperatura', done: false },
      ] },
    { id: 'm2', code: 'MNT-2038', nodeId: 'n4', node: 'Nodo Industrial Florencia',  type: 'correctivo', state: 'pendiente', resp: 'José Alvarado',  date: '2026-06-05', equip: 'Generador diésel', recurring: false, priority: 'alta',  exec: 'terceros',
      tasks: [{ label: 'Diagnóstico de falla', done: false }, { label: 'Solicitud de repuesto', done: false }] },
    { id: 'm3', code: 'MNT-2033', nodeId: 'n3', node: 'Repetidora Cerro Chato',     type: 'preventivo', state: 'cerrado',   resp: 'Karla Méndez',   date: '2026-05-28', equip: '—',               recurring: true,  priority: 'media', exec: 'interno',
      tasks: [
        { label: 'Revisión de cableado estructurado', done: true },
        { label: 'Actualización de firmware switch', done: true },
        { label: 'Limpieza general del rack', done: true },
        { label: 'Prueba de continuidad', done: true },
      ] },
    { id: 'm4', code: 'MNT-2029', nodeId: 'n2', node: 'Nodo Aguas Zarcas',          type: 'preventivo', state: 'progreso',  resp: 'José Alvarado',  date: '2026-06-06', equip: '—',               recurring: true,  priority: 'media', exec: 'interno',
      tasks: [{ label: 'Inspección visual', done: true }, { label: 'Limpieza', done: false }, { label: 'Pruebas', done: false }] },
    { id: 'm5', code: 'MNT-2025', nodeId: 'n5', node: 'Subestación Pital',          type: 'correctivo', state: 'cerrado',   resp: 'Adriana Vargas', date: '2026-05-22', equip: 'UPS 6kVA',         recurring: false, priority: 'baja',  exec: 'terceros',
      tasks: [
        { label: 'Revisión de cableado estructurado', done: true },
        { label: 'Reemplazo de batería', done: true },
        { label: 'Prueba de carga', done: true },
        { label: 'Cierre de orden', done: true },
      ] },
    { id: 'm6', code: 'MNT-2019', nodeId: 'n6', node: 'Nodo Venecia',               type: 'preventivo', state: 'pendiente', resp: 'Greivin Salas',  date: '2026-06-09', equip: '—',               recurring: true,  priority: 'media', exec: 'interno',
      tasks: [{ label: 'Inspección', done: false }] },
  ],

  evidence: [
    { id: 'v1', name: 'gabinete-frontal.jpg', kind: 'image', size: '2.4 MB', date: '2026-06-04 09:32', by: 'A. Vargas' },
    { id: 'v2', name: 'medicion-voltaje.jpg', kind: 'image', size: '1.8 MB', date: '2026-06-04 10:05', by: 'A. Vargas' },
    { id: 'v3', name: 'reporte-ups.pdf',      kind: 'doc',   size: '320 KB', date: '2026-06-04 10:21', by: 'A. Vargas' },
    { id: 'v4', name: 'filtros-limpieza.jpg', kind: 'image', size: '2.1 MB', date: '2026-06-04 09:48', by: 'J. Alvarado' },
  ],

  users: [
    { id: 'u1', name: 'Adriana Vargas', email: 'a.vargas@coopelesca.cr',  role: 'Administrador', status: 'activo',   last: 'hace 5 min',  initials: 'AV', color: 'var(--blue-600)' },
    { id: 'u2', name: 'José Alvarado',  email: 'j.alvarado@coopelesca.cr', role: 'Operador',      status: 'activo',   last: 'hace 1 h',    initials: 'JA', color: 'var(--green-600)' },
    { id: 'u3', name: 'Karla Méndez',   email: 'k.mendez@coopelesca.cr',   role: 'Operador',      status: 'activo',   last: 'ayer',        initials: 'KM', color: 'var(--amber-500)' },
    { id: 'u4', name: 'Greivin Salas',  email: 'g.salas@coopelesca.cr',    role: 'Operador',      status: 'inactivo', last: 'hace 8 días', initials: 'GS', color: 'var(--navy-600)' },
    { id: 'u5', name: 'Mauricio Solís', email: 'm.solis@coopelesca.cr',    role: 'Administrador', status: 'activo',   last: 'hace 30 min', initials: 'MS', color: 'var(--red-600)' },
  ],

  kpis: [
    { key: 'pendientes', label: 'Pendientes',   value: 18,  accent: 'var(--red-600)',   fg: 'var(--red-700)',   delta: '▲ 4 esta semana', deltaColor: 'var(--red-700)' },
    { key: 'progreso',   label: 'En ejecución', value: 9,   accent: 'var(--amber-500)', fg: 'var(--amber-700)', delta: '2 vencen hoy',     deltaColor: 'var(--fg-3)' },
    { key: 'cerrados',   label: 'Cerrados',     value: 146, accent: 'var(--green-600)', fg: 'var(--green-700)', delta: '▲ 11 este mes',   deltaColor: 'var(--green-700)' },
    { key: 'preventivo', label: 'Preventivos',  value: 31,  accent: 'var(--blue-600)',  fg: 'var(--blue-700)',  delta: '7 recurrentes',    deltaColor: 'var(--fg-3)' },
    { key: 'correctivo', label: 'Correctivos',  value: 12,  accent: 'var(--navy-600)',  fg: 'var(--navy-700)',  delta: '4 abiertos',       deltaColor: 'var(--fg-3)' },
  ],

  // Actividad de las últimas 8 semanas (cerrados: preventivo vs correctivo)
  trend: [
    { w: 'S1', prev: 7, corr: 2 }, { w: 'S2', prev: 11, corr: 4 }, { w: 'S3', prev: 8, corr: 3 },
    { w: 'S4', prev: 13, corr: 5 }, { w: 'S5', prev: 10, corr: 3 }, { w: 'S6', prev: 15, corr: 2 },
    { w: 'S7', prev: 12, corr: 6 }, { w: 'S8', prev: 16, corr: 4 },
  ],

  // Eventos del calendario (junio 2026). `day` = día del mes.
  calendar: [
    { day: 2,  code: 'MNT-2050', node: 'Subestación Pital',          type: 'preventivo', state: 'cerrado' },
    { day: 4,  code: 'MNT-2041', node: 'Subestación Ciudad Quesada', type: 'preventivo', state: 'progreso' },
    { day: 5,  code: 'MNT-2038', node: 'Nodo Industrial Florencia',  type: 'correctivo', state: 'pendiente' },
    { day: 6,  code: 'MNT-2029', node: 'Nodo Aguas Zarcas',          type: 'preventivo', state: 'progreso' },
    { day: 9,  code: 'MNT-2019', node: 'Nodo Venecia',               type: 'preventivo', state: 'pendiente' },
    { day: 9,  code: 'MNT-2061', node: 'Nodo Río Cuarto',            type: 'correctivo', state: 'pendiente' },
    { day: 12, code: 'MNT-2044', node: 'Repetidora Muelle',          type: 'preventivo', state: 'cerrado' },
    { day: 16, code: 'MNT-2070', node: 'Subestación Ciudad Quesada', type: 'preventivo', state: 'pendiente' },
    { day: 18, code: 'MNT-2072', node: 'Nodo Industrial Florencia',  type: 'correctivo', state: 'progreso' },
    { day: 23, code: 'MNT-2081', node: 'Repetidora Cerro Chato',     type: 'preventivo', state: 'pendiente' },
    { day: 24, code: 'MNT-2055', node: 'Subestación Pital',          type: 'preventivo', state: 'pendiente' },
    { day: 30, code: 'MNT-2090', node: 'Nodo Venecia',               type: 'preventivo', state: 'pendiente' },
  ],
};

/* Helpers de estado/color y cálculo de avance del checklist.
   El color es siempre dirigido por datos — no se codifican hex en las pantallas. */
export const NK = {
  health: {
    green: { fg: 'var(--green-700)', bg: 'var(--green-50)', solid: 'var(--green-600)', label: 'Sin pendientes' },
    amber: { fg: 'var(--amber-700)', bg: 'var(--amber-50)', solid: 'var(--amber-500)', label: 'Tareas incompletas' },
    red:   { fg: 'var(--red-700)',   bg: 'var(--red-50)',   solid: 'var(--red-600)',   label: 'Pendientes' },
  },
  state: {
    pendiente: { fg: 'var(--red-700)',   bg: 'var(--red-50)',   solid: 'var(--red-600)',   label: 'Pendiente' },
    progreso:  { fg: 'var(--amber-700)', bg: 'var(--amber-50)', solid: 'var(--amber-500)', label: 'En progreso' },
    cerrado:   { fg: 'var(--green-700)', bg: 'var(--green-50)', solid: 'var(--green-600)', label: 'Cerrado' },
  },
  equipStatus: {
    operativo: { fg: 'var(--green-700)', bg: 'var(--green-50)', solid: 'var(--green-600)', label: 'Operativo' },
    alerta:    { fg: 'var(--amber-700)', bg: 'var(--amber-50)', solid: 'var(--amber-500)', label: 'Alerta' },
    falla:     { fg: 'var(--red-700)',   bg: 'var(--red-50)',   solid: 'var(--red-600)',   label: 'Falla' },
  },
  // Porcentaje de avance del checklist (regla: solo se cierra al 100%).
  pct: (tasks) => Math.round((100 * tasks.filter((t) => t.done).length) / tasks.length),
};
