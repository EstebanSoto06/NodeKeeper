import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Las pruebas de integracion (auth, equipment, network-nodes,
    // support-providers, maintenance, checklist-tasks) comparten una unica
    // base de datos PostgreSQL real. Por defecto Vitest ejecuta los
    // archivos de prueba en paralelo en workers distintos; combinado con
    // las transacciones Serializable de runSerializableTransaction, eso
    // generaba contencion real entre archivos NO relacionados entre si
    // (confirmado empiricamente: 0 fallas en 15 corridas del archivo
    // checklist-task.test.js aislado, vs 2 fallas en 15 corridas de la
    // suite completa en paralelo). fileParallelism:false hace que los
    // archivos se ejecuten uno a la vez, eliminando esa fuente de
    // no-determinismo entre pruebas independientes.
    //
    // Esto NO reduce la cobertura de concurrencia de negocio: las carreras
    // intencionales (create/update/delete/status vs start/complete) siguen
    // usando Promise.all DENTRO de una misma prueba, en el mismo archivo,
    // lo cual es concurrencia real de la aplicacion y no depende en
    // absoluto de que Vitest paralelice archivos.
    fileParallelism: false,
  },
});
