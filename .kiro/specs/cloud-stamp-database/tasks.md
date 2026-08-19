# Plan de Implementación: Base de Datos de Sellos en la Nube

## Visión general

Esta implementación se divide en 4 fases: infraestructura AWS, backend (Lambda), cliente escritorio (servicio de sincronización + migración DB), e interfaz de usuario. Cada fase es desplegable de forma independiente.

## Tareas

- [x] 1. Infraestructura AWS: Bucket S3 y DynamoDB
  - [x] 1.1 Añadir al template CloudFormation el bucket `svvs-kiosko-stamps`
    - Bucket privado, sin acceso público, cifrado SSE-S3
    - Bloqueo de acceso público completo (BlockPublicAcls, BlockPublicPolicy, IgnorePublicAcls, RestrictPublicBuckets)
    - Tag Project: svvs-kiosko
    - _Requisitos: 1.1, 1.2, 1.3_

  - [x] 1.2 Añadir al template CloudFormation la tabla DynamoDB `svvs-kiosko-stamp-catalog`
    - Partition Key: `username` (String)
    - Sort Key: `stampId` (String) con formato `{año}#{nombre-sello}`
    - BillingMode: PAY_PER_REQUEST
    - Tag Project: svvs-kiosko
    - _Requisitos: 2.1_

  - [x] 1.3 Actualizar el rol IAM `LambdaExecutionRole` con permisos adicionales
    - s3:ListBucket y s3:GetObject sobre el bucket stamps
    - dynamodb:Query, dynamodb:PutItem, dynamodb:DeleteItem sobre stamp-catalog
    - s3:PutObject para generar presigned URLs (si necesario por SDK)
    - _Requisitos: 2.2, 2.3, 2.4_

  - [x] 1.4 Desplegar la infraestructura actualizada
    - Ejecutar `aws cloudformation deploy` con el template actualizado
    - Verificar que el bucket y la tabla se crean correctamente
    - Crear carpeta de prueba en S3: `test/2026/TestSello/TestSello-fondo.jpg` y `TestSello-sello.png`

- [x] 2. Backend: Lambda de sincronización
  - [x] 2.1 Crear la carpeta `aws/lambdas/sync-stamps/` con package.json
    - Dependencias: @aws-sdk/client-s3, @aws-sdk/client-dynamodb, @aws-sdk/s3-request-presigner
    - Script de empaquetado similar a las lambdas existentes (login, activate)
    - _Requisitos: 2.2, 3.1_

  - [x] 2.2 Implementar la verificación de identidad en la Lambda
    - Recibir body: `{ apiKey, machineId }`
    - Buscar usuario por apiKey en tabla `svvs-kiosko-users` (ScanCommand con filtro)
    - Verificar que machineId está en activeMachines del usuario
    - Si falla: devolver 401 con `{ ok: false, error: "AUTH_FAILED", reason: "..." }`
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.3 Implementar el escaneo del bucket S3
    - ListObjectsV2 con prefix `{username}/`
    - Parsear la estructura: extraer año y nombre-sello de las rutas
    - Validar que cada carpeta tiene fondo (.jpg) y logo (.png)
    - Marcar como `incomplete` si falta alguno de los dos archivos
    - _Requisitos: 1.4, 1.5, 2.5_

  - [x] 2.4 Implementar la sincronización con DynamoDB
    - Query de registros existentes del usuario en stamp-catalog
    - Detectar altas: carpetas en S3 que no tienen registro en DynamoDB → PutItem
    - Detectar bajas: registros en DynamoDB sin carpeta en S3 → DeleteItem
    - Actualizar `updatedAt` en registros modificados
    - _Requisitos: 2.3, 2.4, 2.5_

  - [x] 2.5 Generar presigned URLs y devolver respuesta
    - Para cada sello completo, generar presigned URL del fondo y del logo (expiración: 5 min)
    - Construir respuesta con catálogo completo + resumen de cambios (added, removed, total)
    - _Requisitos: 4.1, 4.3_

  - [x] 2.6 Añadir el endpoint `/api/stamps/sync` al API Gateway en el template
    - Recurso: /api/stamps/sync
    - Método: POST + OPTIONS (CORS)
    - Integración: AWS_PROXY con la Lambda sync-stamps
    - Permisos de invocación Lambda
    - _Requisitos: 3.1_

  - [x] 2.7 Desplegar y probar la Lambda
    - Empaquetar con Compress-Archive
    - Actualizar function code con AWS CLI
    - Test manual con payload de prueba (apiKey válido + machineId registrado)
    - Test con apiKey inválido → esperar 401
    - Test con machineId no registrado → esperar 401

- [x] 3. Cliente Escritorio: Servicio de sincronización
  - [x] 3.1 Crear migración SQL para la tabla `stamps`
    - Archivo: `src/main/database/migrations/NNN_create_stamps_table.sql`
    - CREATE TABLE stamps (id, stamp_id UNIQUE, year, stamp_name, fondo_path, logo_path, status, synced_at, created_at)
    - CREATE INDEX idx_stamps_year ON stamps(year)
    - _Requisitos: 4.5_

  - [x] 3.2 Crear migración SQL para el campo `blocked` en config
    - Añadir soporte para un flag de bloqueo persistente en la aplicación
    - Puede ser una nueva fila en config o una tabla `app_state`
    - _Requisitos: 6.3, 6.4_

  - [x] 3.3 Crear el repositorio `src/main/database/repositories/stamps.repository.ts`
    - Métodos: getAll(), getByYear(year), upsert(stamp), remove(stampId), clear()
    - Interfaz StampRecord que mapea la tabla stamps
    - _Requisitos: 4.2, 4.4, 4.5_

  - [x] 3.4 Crear el servicio `src/main/stamps/stamp-sync-service.ts`
    - Función principal: `syncStamps(): Promise<StampSyncResult>`
    - Paso 1: Obtener apiKey (de config.json) y machineId
    - Paso 2: POST a /api/stamps/sync
    - Paso 3: Manejar error AUTH_FAILED → ejecutar bloqueo
    - Paso 4: Comparar catálogo recibido con DB local
    - Paso 5: Descargar imágenes nuevas (fetch presigned URLs, guardar en userData/stamps/)
    - Paso 6: Eliminar imágenes de sellos borrados
    - Paso 7: Actualizar tabla stamps en SQLite
    - Paso 8: Devolver resumen
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 3.5 Implementar el flujo de bloqueo en `stamp-sync-service.ts`
    - Función: `blockApplication(): void`
    - Borrar todos los registros de la tabla stamps
    - Borrar la carpeta userData/stamps/ recursivamente
    - Eliminar el archivo .license-ticket
    - Establecer flag `blocked = true` en la DB
    - Registrar el intento fallido con fecha, machineId y apiKey
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 3.5, 3.6_

  - [x] 3.6 Integrar verificación de bloqueo en el arranque de la app
    - En el flujo de inicio, comprobar si `blocked = true` en la DB
    - Si bloqueado: mostrar solo la pantalla de bloqueo, no cargar el resto de la app
    - Mostrar machineId para diagnóstico
    - _Requisitos: 6.4, 6.5_

  - [x] 3.7 Registrar handlers IPC para sincronización
    - Handler: `stamps:sync` → llama a syncStamps()
    - Handler: `stamps:getAll` → devuelve todos los stamps locales
    - Handler: `stamps:getStatus` → devuelve el estado de sincronización
    - Exponer en preload para el renderer
    - _Requisitos: 4.7, 5.2_

- [x] 4. Interfaz de usuario: Sección "Base de datos sellos"
  - [x] 4.1 Crear componente `StampDatabaseSection` en la vista de configuración
    - Ubicación: `src/renderer/src/components/settings/StampDatabaseSection.tsx`
    - Título: "Base de datos sellos"
    - Mostrar estado de última sincronización y total de sellos
    - _Requisitos: 5.1, 5.7_

  - [x] 4.2 Implementar la lista de sellos agrupada por año
    - Leer stamps desde el store (Zustand) vía IPC
    - Agrupar por año, mostrar como acordeones o secciones colapsables
    - Cada entrada: nombre del sello + miniaturas de fondo y logo
    - _Requisitos: 5.2, 5.3_

  - [x] 4.3 Implementar el botón "Sincronizar con la nube"
    - Botón con icono de sincronización
    - Al hacer click: invocar `stamps:sync` vía IPC
    - Mientras sincroniza: mostrar spinner, deshabilitar botón
    - Al terminar: mostrar resumen (toast o inline) con añadidos/eliminados
    - Si error: mostrar mensaje de error
    - _Requisitos: 5.4, 5.6, 4.7_

  - [x] 4.4 Implementar detección de conexión y estado deshabilitado
    - Usar `navigator.onLine` para detectar conexión
    - Si offline: deshabilitar botón con tooltip "Se requiere conexión a internet"
    - _Requisitos: 5.5_

  - [x] 4.5 Implementar la pantalla de bloqueo
    - Componente: `src/renderer/src/components/BlockedScreen.tsx`
    - Pantalla completa que reemplaza toda la app
    - Mensaje: "Aplicación bloqueada. Contacte con soporte."
    - Mostrar machineId del equipo para diagnóstico
    - No permitir navegar ni cerrar la pantalla
    - _Requisitos: 6.5_

- [x] 5. Pruebas e integración
  - [x] 5.1 Test de la Lambda sync-stamps
    - Test con usuario válido y bucket con sellos → esperar catálogo correcto
    - Test con apiKey inválida → esperar 401
    - Test con machineId no registrado → esperar 401
    - Test con carpeta incompleta (sin logo) → esperar status incomplete

  - [x] 5.2 Test del servicio stamp-sync-service
    - Mock del endpoint API y verificar flujo completo
    - Verificar que el bloqueo elimina datos locales correctamente
    - Verificar que la descarga de imágenes las guarda en la ruta correcta

  - [x] 5.3 Test end-to-end del flujo de sincronización
    - Subir imágenes de prueba al bucket S3
    - Ejecutar sincronización desde la app
    - Verificar que las imágenes aparecen en la lista de configuración
    - Eliminar una carpeta del bucket y re-sincronizar
    - Verificar que el sello desaparece de la lista local

- [x] 6. Documentación y scripts operativos
  - [x] 6.1 Actualizar `aws/README.md` con la documentación del nuevo endpoint y bucket
  - [x] 6.2 Crear script `aws/scripts/upload-stamps.ps1` para subir imágenes al bucket de un usuario
  - [x] 6.3 Documentar en el README el procedimiento para dar de alta sellos a un usuario

## Fases diferidas

Las siguientes mejoras quedan fuera de esta entrega:

- **Sincronización automática al arranque**: Actualmente es solo bajo demanda (botón). Se podría añadir una sincronización silenciosa al iniciar la app si hay conexión.
- **S3 Event Notifications**: Para volúmenes grandes, se podría reaccionar a cambios en S3 en tiempo real en lugar de escanear on-demand.
- **Caché de miniaturas**: Generar thumbnails optimizados en lugar de cargar las imágenes completas en la lista.
- **Sincronización selectiva por año**: Permitir al usuario elegir qué años descargar.
- **Versionado de imágenes**: Detectar si una imagen se ha actualizado (no solo alta/baja de carpetas).
