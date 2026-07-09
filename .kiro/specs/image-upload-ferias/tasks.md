# Plan de Implementación: image-upload-ferias

## Visión General

Implementación del sistema de gestión de imágenes basado en carpetas. Se construye de forma incremental: primero la capa de datos (migración + repositorio), luego el sincronizador, después los canales IPC, el store del frontend, las vistas, y finalmente la integración con el generador PDF.

## Tareas

- [x] 1. Crear migración y repositorio de image_sync
  - [x] 1.1 Crear migración SQL `003_image_sync.sql`
    - Crear archivo `src/main/database/migrations/003_image_sync.sql`
    - Definir tabla `image_sync` con campos: id, year, fair_name, image_type, file_path (UNIQUE), mtime, image_name, synced_at
    - Añadir constraint CHECK para image_type IN ('fondo', 'sello')
    - Añadir constraint UNIQUE(year, fair_name, image_type)
    - Crear índice `idx_image_sync_fair` sobre (year, fair_name)
    - _Requisitos: 2.1_

  - [x] 1.2 Implementar `ImageSyncRepository`
    - Crear archivo `src/main/database/repositories/image-sync.repository.ts`
    - Implementar métodos: getAll(), getByFilePath(), upsert(), deleteOrphans(), getFairList(), getByFair()
    - Seguir el patrón de los repositorios existentes (config.repository.ts, images.repository.ts)
    - _Requisitos: 2.1, 3.1, 9.1_

  - [ ]* 1.3 Escribir tests unitarios para ImageSyncRepository
    - Crear archivo `src/main/database/__tests__/image-sync.repository.test.ts`
    - Test CRUD con base de datos en memoria
    - Test de getFairList() con múltiples ferias
    - Test de deleteOrphans() eliminando registros huérfanos
    - _Requisitos: 2.1, 9.1_

- [x] 2. Implementar módulo sincronizador
  - [x] 2.1 Crear funciones de escaneo y clasificación
    - Crear archivo `src/main/images/sync-images.ts`
    - Implementar `classifyImageFile(fileName)`: clasifica por sufijo -fondo/-sello
    - Implementar `buildImageName(year, fairName, imageType)`: genera nombre único
    - Implementar `fileToDataUri(filePath)`: lee archivo y convierte a Data URI Base64
    - Implementar `scanFairFolders(basePath)`: escanea estructura bbdd-ferias/{año}/{feria}/
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implementar lógica principal de sincronización
    - Implementar `syncImages(basePath)` en `src/main/images/sync-images.ts`
    - Comparar mtime de archivos en disco vs registros en image_sync
    - Insertar registros nuevos (archivo nuevo → leer + convertir Base64 + INSERT)
    - Actualizar registros modificados (mtime posterior → leer + convertir + UPDATE)
    - Eliminar registros huérfanos (sin archivo en disco → DELETE)
    - No realizar escrituras si nada ha cambiado
    - Retornar SyncResult con contadores y errores
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.3 Escribir property test para clasificación de archivos
    - **Property 1: Clasificación correcta por sufijo**
    - **Valida: Requisitos 1.1, 1.2, 1.3**
    - Crear test en `src/main/images/__tests__/sync-images.property.test.ts`
    - Usar fast-check para generar nombres de archivo arbitrarios
    - Verificar que classifyImageFile devuelve 'fondo', 'sello' o null correctamente

  - [ ]* 2.4 Escribir property test para tolerancia a carpetas incompletas
    - **Property 2: Tolerancia a carpetas incompletas**
    - **Valida: Requisitos 1.4, 1.5**
    - Generar estructuras de carpetas con archivos faltantes usando fast-check
    - Verificar que syncImages completa sin excepción y sin errores por archivos faltantes

  - [ ]* 2.5 Escribir property test para corrección de sincronización
    - **Property 3: Corrección de la sincronización**
    - **Valida: Requisitos 2.2, 2.3, 2.4, 2.5**
    - Generar conjuntos arbitrarios de archivos en disco y registros previos
    - Verificar inserted + updated + deleted + unchanged = max(archivos, registros)
    - Verificar que archivos nuevos tienen registro, modificados se actualizan, huérfanos se eliminan

  - [ ]* 2.6 Escribir property test para idempotencia de sincronización
    - **Property 4: Idempotencia de sincronización**
    - **Valida: Requisitos 2.6**
    - Ejecutar syncImages dos veces con los mismos archivos sin cambios
    - Verificar que la segunda ejecución produce inserted=0, updated=0, deleted=0

- [x] 3. Checkpoint - Verificar sincronizador
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 4. Crear IPC handlers para imágenes de ferias
  - [x] 4.1 Extender IPC handlers de imágenes
    - Modificar `src/main/ipc/images.handlers.ts`
    - Añadir handler `images:getFairList` → devuelve lista de ferias desde ImageSyncRepository.getFairList()
    - Añadir handler `images:getByFair` → recibe (year, fairName), devuelve { fondo: dataUri|null, sello: dataUri|null }
    - Añadir handler `images:getSyncStatus` → devuelve último SyncResult
    - Manejar errores devolviendo mensaje descriptivo sin crash
    - _Requisitos: 9.1, 9.2, 9.3_

  - [x] 4.2 Exponer canales IPC en preload
    - Modificar `src/preload/index.ts` para exponer los nuevos canales al renderer
    - Añadir typings para los nuevos canales IPC
    - _Requisitos: 9.1, 9.2_

  - [ ]* 4.3 Escribir tests unitarios para IPC handlers de imágenes
    - Crear/extender `src/main/ipc/__tests__/images.handlers.test.ts`
    - Test getFairList devuelve datos correctos
    - Test getByFair devuelve imágenes Data URI
    - Test getByFair con feria inexistente devuelve nulls
    - Test manejo de errores SQLite devuelve mensaje sin crash
    - _Requisitos: 9.1, 9.2, 9.3_

- [x] 5. Implementar Images Store (Zustand) en el frontend
  - [x] 5.1 Crear store de imágenes
    - Crear archivo `src/renderer/src/stores/images.store.ts`
    - Implementar estado: fairList, activeFair, fondoImage, selloImage, printFondo, printSello, loading, error
    - Implementar acciones: loadFairList(), selectFair(), setPrintFondo(), setPrintSello()
    - printFondo inicia en false (volátil, no se persiste)
    - printSello se carga desde config persistida en SQLite al inicializar
    - _Requisitos: 3.1, 3.2, 8.1, 8.2, 8.3_

  - [ ]* 5.2 Escribir tests unitarios para images store
    - Crear `src/renderer/src/stores/__tests__/images.store.test.ts`
    - Test estado inicial (printFondo=false, fairList vacía)
    - Test loadFairList carga lista
    - Test selectFair actualiza imágenes
    - Test setPrintSello persiste via IPC
    - _Requisitos: 3.1, 3.2, 8.1, 8.2, 8.3_

- [x] 6. Implementar vistas del frontend
  - [x] 6.1 Crear sección de configuración de imágenes
    - Añadir sección en la vista de configuración (o crear componente `src/renderer/src/components/images/ImageConfig.tsx`)
    - Mostrar listado de ferias disponibles (año + nombre)
    - Implementar selector de feria activa
    - Mostrar Checkbox "Imprimir imagen de fondo (pruebas)" → controla printFondo
    - Mostrar Checkbox "Imprimir imagen del sello" → controla printSello
    - _Requisitos: 3.1, 3.4, 5.1, 5.2, 6.1_

  - [x] 6.2 Actualizar Vista Kiosko para mostrar imagen de fondo
    - Modificar `src/renderer/src/views/KioskoView.tsx` o componente relevante en `src/renderer/src/components/kiosko/`
    - Mostrar Imagen_Fondo de la feria activa en zona de previsualización
    - Si no hay imagen disponible, mostrar placeholder con nombre de la feria
    - Mantener proporciones de la imagen sin distorsión
    - _Requisitos: 4.1, 4.2, 4.3, 3.3_

  - [ ]* 6.3 Escribir tests para componentes de imágenes
    - Test que ImageConfig renderiza lista de ferias y checkboxes con labels correctos
    - Test que Vista Kiosko muestra imagen cuando disponible
    - Test que Vista Kiosko muestra placeholder cuando no hay imagen
    - _Requisitos: 3.1, 4.1, 4.2, 5.1, 6.1_

- [x] 7. Checkpoint - Verificar frontend
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 8. Extender generador PDF con composición de capas
  - [x] 8.1 Implementar lógica de composición de capas de imagen
    - Modificar `src/main/printing/pdf-generator.ts`
    - Definir interface `ImageLayerOptions` con { printFondo, printSello, fondoImage, selloImage }
    - Implementar lógica de capas:
      - Solo sello: capas = [sello, texto]
      - Solo fondo: capas = [fondo, texto]
      - Ambos: capas = [fondo, sello, texto]
      - Ninguno: capas = [texto]
    - Si printSello=true pero selloImage es null, generar sin imagen y emitir notificación
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 5.3, 5.4, 6.2, 6.3, 6.4_

  - [ ]* 8.2 Escribir property test para composición de capas PDF
    - **Property 5: Composición correcta de capas en PDF**
    - **Valida: Requisitos 5.3, 5.4, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4**
    - Crear test en `src/main/printing/__tests__/pdf-layers.property.test.ts`
    - Usar fast-check para generar todas las combinaciones de printFondo/printSello
    - Verificar que las capas resultantes siguen las reglas definidas

  - [ ]* 8.3 Escribir tests unitarios para generador PDF con imágenes
    - Crear/extender `src/main/printing/__tests__/pdf-generator.test.ts`
    - Test con sello activado y fondo desactivado
    - Test con ambos activados
    - Test con ambos desactivados
    - Test con sello activado pero imagen null (notificación)
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 6.4_

- [x] 9. Integrar sincronización en el arranque de la aplicación
  - [x] 9.1 Conectar sincronizador al flujo de inicio
    - Modificar `src/main/index.ts` o `src/main/services.ts`
    - Ejecutar syncImages() después de initDatabase() y antes de registerAllHandlers()
    - Manejar el caso donde la carpeta bbdd-ferias/ no existe (completar sin error)
    - Registrar resultado de sync en logs (info: inicio/fin, contadores)
    - _Requisitos: 2.1_

  - [x] 9.2 Conectar persistencia de printSello en config
    - Extender el repositorio de config para incluir sección "imagenes" con printSello y activeFair
    - Al inicializar images store, cargar printSello desde config
    - Al cambiar printSello, persistir en config vía IPC
    - _Requisitos: 8.1, 8.2, 8.3_

  - [x] 9.3 Conectar images store con generador PDF
    - Modificar el flujo de generación de venta/impresión para pasar ImageLayerOptions
    - Leer printFondo, printSello, fondoImage, selloImage desde images store al generar PDF
    - _Requisitos: 5.3, 5.4, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4_

- [x] 10. Checkpoint final - Verificar integración completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los property tests validan propiedades universales de corrección definidas en el diseño
- Los tests unitarios validan ejemplos específicos y casos límite
- El lenguaje de implementación es TypeScript (consistente con el proyecto existente)
