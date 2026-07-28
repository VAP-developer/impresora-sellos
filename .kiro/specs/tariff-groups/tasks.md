# Plan de Implementación: Grupos de Tarifas

## Resumen

Implementación del sistema de grupos de tarifas dinámicos siguiendo la arquitectura de capas existente: SQL → Repository → IPC Handlers → Preload Bridge → IPC Client → Zustand Store → React Components. Se construye desde la capa más interna (base de datos) hacia la más externa (componentes UI), asegurando que cada capa tiene dependencias resueltas antes de implementar.

## Tareas

- [x] 1. Capa de base de datos y repositorio
  - [x] 1.1 Crear migración SQL `005_tariff_groups.sql`
    - Crear tabla `tariff_groups` con columnas: id, year, title, currency, created_at, updated_at
    - Crear tabla `tariffs` con columnas: id, group_id, name, price, position, FK con ON DELETE CASCADE
    - Crear índice UNIQUE en `tariff_groups(year, title)`
    - Crear índice en `tariff_groups(year)` para búsquedas rápidas
    - Crear índice en `tariffs(group_id)`
    - Añadir columna `tariff_group_id` a la tabla `eventos` (ALTER TABLE, nullable)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 6.5_

  - [x] 1.2 Implementar `TariffGroupsRepository` en `src/main/database/repositories/tariff-groups.repository.ts`
    - Definir interfaces TypeScript: `TariffGroup`, `Tariff`, `TariffGroupInput`, `TariffInput`, `TariffGroupUpdateInput`
    - Implementar `getYears()`: devuelve años distintos en orden descendente
    - Implementar `getAll()`: devuelve todos los grupos con sus tarifas incluidas
    - Implementar `getByYear(year)`: devuelve grupos de un año con tarifas
    - Implementar `getById(id)`: devuelve un grupo con sus tarifas o null
    - Implementar `create(input)`: inserta grupo + tarifas atómicamente en transacción
    - Implementar `update(id, input)`: actualiza grupo + sincroniza tarifas (delete + re-insert) en transacción
    - Implementar `delete(id)`: verifica eventos asociados antes de eliminar, falla con error si hay referencias
    - Implementar `getEventsByGroupId(groupId)`: consulta eventos que referencian el grupo
    - Implementar validación backend: cardinalidad 2-10, nombres 1-16 chars, precios > 0, moneda no vacía, título no vacío
    - Seguir el patrón de `EventosRepository` para constructor con DB inyectable
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 3.2, 3.5, 4.2, 4.3, 5.5, 8.8, 9.1_

  - [ ]* 1.3 Escribir property tests del repositorio (Propiedades 1-4)
    - **Propiedad 1: Round-trip de persistencia** — generar inputs válidos aleatorios con fast-check, crear grupo, recuperar por ID, verificar igualdad de campos
    - **Valida: Requisitos 1.1, 1.2, 2.2**
    - **Propiedad 2: Round-trip de actualización** — generar ediciones válidas aleatorias, aplicar update, recuperar, verificar cambios
    - **Valida: Requisitos 3.2**
    - **Propiedad 3: Eliminación en cascada** — crear grupo con N tarifas, eliminar, verificar que no quedan tarifas huérfanas
    - **Valida: Requisitos 1.3, 4.2**
    - **Propiedad 4: Unicidad año + título** — verificar que duplicados son rechazados con error descriptivo
    - **Valida: Requisitos 1.4, 2.3, 3.5**
    - Archivo: `src/main/database/__tests__/tariff-groups.repository.property.test.ts`

  - [ ]* 1.4 Escribir property tests del repositorio (Propiedades 5-10)
    - **Propiedad 5: Validación de cardinalidad** — generar tarifas fuera de rango [2,10], verificar rechazo
    - **Valida: Requisitos 2.4, 2.5, 3.3, 3.4**
    - **Propiedad 6: Validación de tarifas individuales** — generar nombres/precios inválidos, verificar rechazo con mensaje
    - **Valida: Requisitos 5.1, 5.2, 5.3, 5.4, 5.5**
    - **Propiedad 7: Integridad referencial en eliminación** — crear grupo asociado a evento, verificar que delete falla
    - **Valida: Requisitos 4.3**
    - **Propiedad 8: Asociación evento-grupo round-trip** — guardar evento con tariff_group_id, recuperar, verificar referencia
    - **Valida: Requisitos 6.4, 6.5**
    - **Propiedad 9: Invariante de ordenamiento** — crear grupo con posiciones aleatorias, verificar que getById devuelve tarifas ordenadas por position
    - **Valida: Requisitos 7.3, 9.3**
    - **Propiedad 10: Corrección de consulta por año** — crear grupos en varios años, verificar getYears() descendente y getByYear() filtra correctamente
    - **Valida: Requisitos 9.1, 9.2**
    - Archivo: `src/main/database/__tests__/tariff-groups.repository.property.test.ts`

- [x] 2. Checkpoint - Verificar capa de datos
  - Asegurar que la migración se ejecuta correctamente y todos los tests pasan. Preguntar al usuario si hay dudas.

- [x] 3. Capa IPC y comunicación
  - [x] 3.1 Implementar IPC handlers en `src/main/ipc/tariff-groups.handlers.ts`
    - Crear función `registerTariffGroupsHandlers()` siguiendo el patrón de `registerEventosHandlers()`
    - Registrar canal `tariff-groups:getYears` → `repo.getYears()`
    - Registrar canal `tariff-groups:getAll` → `repo.getAll()`
    - Registrar canal `tariff-groups:getByYear` → `repo.getByYear(year)`
    - Registrar canal `tariff-groups:getById` → `repo.getById(id)`
    - Registrar canal `tariff-groups:create` → `repo.create(input)`
    - Registrar canal `tariff-groups:update` → `repo.update(id, input)`
    - Registrar canal `tariff-groups:delete` → `repo.delete(id)`
    - Envolver errores con manejo limpio (no crash de app)
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 3.2 Registrar handlers en el entry point principal
    - Importar y llamar `registerTariffGroupsHandlers()` en `src/main/ipc/handlers.ts` o donde se registran los demás handlers
    - _Requisitos: 8.1_

  - [x] 3.3 Extender el preload bridge en `src/preload/index.ts`
    - Añadir namespace `tariffGroups` a la interfaz `ElectronAPI`
    - Implementar los 7 métodos IPC: getYears, getAll, getByYear, getById, create, update, delete
    - Añadir tipos `TariffGroup`, `Tariff`, `TariffGroupInput`, `TariffGroupUpdateInput` al preload
    - Actualizar `src/preload/index.d.ts` con la tipificación correspondiente
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 3.4 Extender el IPC client en `src/renderer/src/lib/ipc-client.ts`
    - Añadir funciones wrapper: `getTariffGroupYears`, `getAllTariffGroups`, `getTariffGroupsByYear`, `getTariffGroupById`, `createTariffGroup`, `updateTariffGroup`, `deleteTariffGroup`
    - Exportar tipos `TariffGroup`, `Tariff`, `TariffGroupInput`, `TariffGroupUpdateInput`
    - Seguir el patrón de las funciones de eventos existentes
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 3.5 Escribir tests de integración IPC
    - Test de canal `tariff-groups:create` → verificar que devuelve grupo con tarifas
    - Test de canal `tariff-groups:getByYear` → verificar filtrado correcto
    - Test de canal `tariff-groups:delete` con grupo en uso → verificar error descriptivo
    - Archivo: `src/main/ipc/__tests__/tariff-groups.handlers.test.ts`
    - _Requisitos: 8.1, 8.4, 8.6, 8.8_

- [x] 4. Checkpoint - Verificar capa IPC
  - Asegurar que todos los tests pasan y la comunicación IPC funciona correctamente. Preguntar al usuario si hay dudas.

- [x] 5. Estado del frontend (stores)
  - [x] 5.1 Crear store `src/renderer/src/stores/tariff-groups.store.ts`
    - Implementar `TariffGroupsState` con: groups, years, selectedYear, selectedGroup, loading, error
    - Implementar acciones: loadYears, loadByYear, loadAll, selectGroup, createGroup, updateGroup, deleteGroup
    - Usar las funciones del IPC client para comunicarse con el backend
    - Manejar errores almacenándolos en `state.error`
    - Seguir el patrón de los stores Zustand existentes
    - _Requisitos: 9.1, 9.2, 2.2, 3.2, 4.2_

  - [x] 5.2 Refactorizar `src/renderer/src/stores/kiosko.store.ts` para cantidades dinámicas
    - Cambiar `quantities: KioskoQuantities` (fijo) a `quantities: DynamicQuantities` (Record<string, number>)
    - Añadir campo `activeTariffGroup: TariffGroup | null`
    - Refactorizar `setQuantity` para aceptar tariffId + model en lugar de campo fijo
    - Mantener `reset()`, `normalizeAll()`, `recordLastSale()`, `clearLastSale()`
    - Adaptar `getTotal()`, `getUsedRollo1()`, `getUsedRollo2()` para calcular con tarifas dinámicas
    - Añadir acción `setActiveTariffGroup(group)` que resetea quantities al cambiar de grupo
    - Mantener compatibilidad con `validateSale()` adaptándola al nuevo formato
    - _Requisitos: 7.1, 7.2, 7.4_

  - [x] 5.3 Refactorizar `src/renderer/src/lib/tariff-calc.ts` para tarifas dinámicas
    - Añadir función `calcDynamicTotal(quantities: DynamicQuantities, tariffs: Tariff[]): number`
    - Añadir función `calcDynamicUsedRollo(quantities: DynamicQuantities, tariffs: Tariff[], model: 1 | 2): number`
    - Añadir función `calcDynamicLimits(quantities: DynamicQuantities, tariffs: Tariff[], ticket, sello): DynamicLimits`
    - Mantener las funciones existentes para compatibilidad durante la migración
    - Exportar tipo `DynamicQuantities` y `DynamicLimits`
    - _Requisitos: 7.1, 7.2_

  - [ ]* 5.4 Escribir property test para cálculo dinámico (Propiedad 11)
    - **Propiedad 11: Cálculo de total con tarifas dinámicas** — generar N tarifas con precios y cantidades aleatorias, verificar que total = Σ(qty × price) para ambos modelos
    - **Valida: Requisitos 7.1, 7.2**
    - Archivo: `src/renderer/src/lib/__tests__/tariff-calc.dynamic.property.test.ts`

- [x] 6. Checkpoint - Verificar estado del frontend
  - Asegurar que todos los tests pasan y los stores funcionan correctamente. Preguntar al usuario si hay dudas.

- [x] 7. Componentes de la Vista Imprimir (gestión de grupos)
  - [x] 7.1 Crear componente `TariffGroupSection` en `src/renderer/src/components/imprimir/TariffGroupSection.tsx`
    - Mostrar selector de año con años disponibles (orden descendente)
    - Listar grupos del año seleccionado mostrando título, moneda, número de tarifas
    - Al seleccionar un grupo, mostrar detalle con todas sus tarifas (nombre, precio, posición)
    - Botones para crear nuevo grupo, editar grupo seleccionado, eliminar grupo
    - Confirmación antes de eliminar (dialog)
    - Mostrar errores (grupo en uso, etc.)
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 4.1_

  - [x] 7.2 Crear componente `TariffGroupEditor` en `src/renderer/src/components/imprimir/TariffGroupEditor.tsx`
    - Formulario con campos: año, título, moneda
    - Lista editable de tarifas: nombre (input text max 16), precio (input number > 0), posición (drag o flechas)
    - Botón añadir tarifa (máximo 10) y botón eliminar tarifa (mínimo 2)
    - Validación frontend antes de envío: título no vacío, moneda no vacía, 2-10 tarifas, nombres 1-16 chars, precios > 0
    - Modo creación: formulario vacío
    - Modo edición: formulario precargado con datos del grupo seleccionado
    - Mostrar mensajes de error de validación inline
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4_

  - [x] 7.3 Integrar secciones de grupos en `ImprimirView`
    - Importar y renderizar `TariffGroupSection` y `TariffGroupEditor` en la vista
    - Colocar después de la sección de eventos existente
    - Pasar callbacks necesarios para refrescar listas tras operaciones CRUD
    - _Requisitos: 9.4_

  - [x] 7.4 Modificar `EventoEditor` para incluir selector de grupo de tarifas
    - Añadir campo desplegable (select) con todos los grupos de tarifas disponibles
    - En modo creación: selector vacío, obligatorio para guardar
    - En modo edición: preseleccionar el grupo actualmente asociado al evento
    - Validar que se selecciona un grupo antes de guardar (impedir guardado sin grupo)
    - Enviar `tariff_group_id` al crear/actualizar evento
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.5 Actualizar `EventosRepository` y handlers para soportar `tariff_group_id`
    - Añadir `tariff_group_id` a `EventoRow` y `EventoInput`
    - Actualizar queries de create/update para incluir `tariff_group_id`
    - Actualizar query de getById/getByYear para devolver `tariff_group_id`
    - _Requisitos: 6.4, 6.5_

  - [ ]* 7.6 Escribir unit tests de componentes de gestión
    - Test de TariffGroupEditor: renderizado de formulario, validación de campos
    - Test de TariffGroupSection: listado por año, selección de grupo
    - Test de EventoEditor: selector de grupo preseleccionado, validación obligatoria
    - _Requisitos: 2.1, 3.1, 6.1, 6.2, 6.3_

- [x] 8. Checkpoint - Verificar Vista Imprimir
  - Asegurar que todos los tests pasan y la gestión CRUD de grupos funciona en la UI. Preguntar al usuario si hay dudas.

- [x] 9. Componentes de la Vista Kiosko (renderizado dinámico)
  - [x] 9.1 Crear componente `DynamicTariffTable` en `src/renderer/src/components/kiosko/DynamicTariffTable.tsx`
    - Recibir el `TariffGroup` activo del store
    - Renderizar una fila `DynamicTariffRow` por cada tarifa del grupo
    - Renderizar dos columnas (Sello A / Sello B) con inputs de cantidad
    - Mostrar nombre de tarifa, precio con tipo de moneda, campo de cantidad
    - Mostrar tarifas en el orden definido por `position`
    - Mostrar el tipo de moneda del grupo junto a los precios
    - _Requisitos: 7.1, 7.2, 7.3, 7.6_

  - [x] 9.2 Crear componente `DynamicTariffRow` en `src/renderer/src/components/kiosko/DynamicTariffRow.tsx`
    - Renderizar nombre de tarifa, precio formateado con moneda, input numérico para cantidad
    - Conectar input con `kioskoStore.setQuantity(tariffId, model, value)`
    - Mostrar límite máximo disponible
    - _Requisitos: 7.1, 7.2_

  - [x] 9.3 Integrar `DynamicTariffTable` en `KioskoView`
    - Reemplazar el componente de tarifas estáticas por `DynamicTariffTable` cuando hay grupo activo
    - Cargar el grupo de tarifas del evento activo al montar la vista
    - Actualizar dinámicamente cuando cambia el evento activo (sin recargar app)
    - Mostrar mensaje "El evento no tiene tarifas configuradas" si el evento no tiene grupo
    - _Requisitos: 7.1, 7.2, 7.4, 7.5_

  - [ ]* 9.4 Escribir unit tests de componentes dinámicos
    - Test de DynamicTariffTable: renderiza N filas según tarifas del grupo
    - Test de DynamicTariffRow: input conectado al store, muestra moneda
    - Test de KioskoView: mensaje cuando no hay grupo, actualización al cambiar evento
    - _Requisitos: 7.1, 7.2, 7.4, 7.5_

- [x] 10. Checkpoint final - Verificar integración completa
  - Asegurar que todos los tests pasan y el flujo completo funciona: crear grupo → asociar a evento → activar evento → ver tarifas dinámicas en kiosko. Preguntar al usuario si hay dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints permiten validación incremental
- Los property tests validan propiedades universales de corrección definidas en el diseño
- Los unit tests validan ejemplos específicos y casos borde
- Se usa `fast-check` como librería de property-based testing
- El lenguaje de implementación es TypeScript (consistente con el proyecto existente)
