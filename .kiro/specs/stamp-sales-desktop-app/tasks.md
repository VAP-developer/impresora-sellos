# Tasks: Stamp Sales Desktop App

## Task 1: Scaffolding del Proyecto y Entorno Virtual

- [x] 1.1 Crear estructura base del proyecto con Electron + React + TypeScript usando electron-vite
- [x] 1.2 Configurar Node.js con nvm (entorno virtual) y fijar version en .nvmrc
- [x] 1.3 Instalar dependencias core: electron, react, react-dom, typescript, electron-vite, tailwindcss
- [x] 1.4 Instalar dependencias de datos: better-sqlite3, zustand
- [x] 1.5 Instalar dependencias de UI: @radix-ui (shadcn), class-variance-authority, clsx, tailwind-merge
- [x] 1.6 Instalar dependencias de desarrollo: vitest, @testing-library/react, eslint, prettier
- [x] 1.7 Configurar tsconfig.json para main, preload y renderer
- [x] 1.8 Configurar electron.vite.config.ts con entradas para main, preload y renderer
- [x] 1.9 Configurar Tailwind CSS (tailwind.config.js + globals.css)
- [x] 1.10 Crear entry points basicos: src/main/index.ts, src/preload/index.ts, src/renderer/src/main.tsx
- [x] 1.11 Verificar que la app arranca con `npm run dev` mostrando una ventana vacia

## Task 2: Base de Datos SQLite y Migraciones

- [x] 2.1 Crear src/main/database/connection.ts con inicializacion de better-sqlite3
- [x] 2.2 Crear migracion 001_initial.sql con tablas: config, orders, images, print_queue, sync_log
- [x] 2.3 Implementar sistema de migraciones automatico al arrancar la app
- [x] 2.4 Crear src/main/database/repositories/config.repository.ts con CRUD de configuracion (JSON)
- [x] 2.5 Crear src/main/database/repositories/orders.repository.ts con insert y export CSV
- [x] 2.6 Crear src/main/database/repositories/images.repository.ts con upload/remove/getByName
- [x] 2.7 Crear src/main/database/repositories/print-queue.repository.ts
- [x] 2.8 Implementar initConfig() que inserta la configuracion inicial por defecto (replica del legacy)
- [x] 2.9 Escribir tests unitarios para cada repository (vitest)
- [x] 2.10 Verificar que al arrancar la app se crea la BD y se ejecutan migraciones

## Task 3: IPC Layer (Comunicacion Main <-> Renderer)

- [ ] 3.1 Crear src/preload/index.ts con contextBridge exponiendo ElectronAPI tipada
- [ ] 3.2 Crear src/main/ipc/handlers.ts con registro centralizado de handlers
- [ ] 3.3 Implementar src/main/ipc/config.handlers.ts (get, updateMaquina, updateImprimir, updateSesion, updateRollos, initConfig)
- [ ] 3.4 Implementar src/main/ipc/orders.handlers.ts (insert, downloadCSV)
- [ ] 3.5 Implementar src/main/ipc/images.handlers.ts (upload, remove, getByName)
- [ ] 3.6 Implementar src/main/ipc/printer.handlers.ts (getStatus, print, pause, resume, getQueue)
- [ ] 3.7 Crear src/renderer/src/lib/ipc-client.ts como wrapper tipado del API
- [ ] 3.8 Escribir tests para los handlers IPC (mock de repositories)
- [ ] 3.9 Verificar comunicacion IPC end-to-end (renderer llama -> main responde)

## Task 4: Stores y Estado del Frontend

- [ ] 4.1 Crear src/renderer/src/types/config.ts con interfaces AppConfig, TicketConfig, CodigoConfig, SelloConfig, PreciosConfig
- [ ] 4.2 Crear src/renderer/src/types/order.ts con interface OrderLine
- [ ] 4.3 Crear src/renderer/src/types/printer.ts con interfaces PrinterInfo, PrintJob
- [ ] 4.4 Implementar src/renderer/src/stores/config.store.ts (carga config, métodos de update)
- [ ] 4.5 Implementar src/renderer/src/stores/kiosko.store.ts (cantidades, calculos de total y limites)
- [ ] 4.6 Implementar src/renderer/src/stores/orders.store.ts
- [ ] 4.7 Implementar src/renderer/src/stores/printer.store.ts
- [ ] 4.8 Crear src/renderer/src/lib/tariff-calc.ts con funciones puras de calculo de limites
- [ ] 4.9 Crear src/renderer/src/lib/code-formatter.ts con formateo de codigo de etiqueta
- [ ] 4.10 Escribir property-based tests para tariff-calc.ts (Properties 1, 2, 14)
- [ ] 4.11 Escribir property-based tests para code-formatter.ts (Property 3)
- [ ] 4.12 Verificar que los stores cargan datos correctamente al iniciar la app

## Task 5: Navegacion y Layout

- [ ] 5.1 Instalar react-router-dom y configurar src/renderer/src/router.tsx con las 5 rutas
- [ ] 5.2 Crear src/renderer/src/components/layout/MainLayout.tsx con estructura base
- [ ] 5.3 Crear src/renderer/src/components/layout/NavComponent.tsx con navegacion entre vistas
- [ ] 5.4 Crear placeholder views: HomeView, KioskoView, MaquinaView, ImprimirView, SubirImagenView
- [ ] 5.5 Verificar navegacion funcional entre todas las vistas

## Task 6: Vista Home (Menu Principal)

- [ ] 6.1 Implementar HomeView con botones de navegacion a Configuracion (Imprimir) y Maquina
- [ ] 6.2 Añadir boton de exportar XLS/CSV que llama a orders.downloadCSV()
- [ ] 6.3 Añadir tooltips informativos (replicando el legacy)
- [ ] 6.4 Verificar que la navegacion y exportacion funcionan

## Task 7: Vista Kiosko (Venta Principal)

- [ ] 7.1 Crear componente StampModels.tsx (imagenes modelo1 y modelo2 con previsualizacion)
- [ ] 7.2 Crear componente TariffRow.tsx (fila de tarifa con inputs cantidad, limite, subtotal para ambos modelos)
- [ ] 7.3 Crear componente TariffTable.tsx (tabla completa: Tarifa A Tira 4, Tira 4 Tarifas, Tarifa A, A2, B, C)
- [ ] 7.4 Crear componente CartControls.tsx (total cesta, presupuesto restante, modo impresion, botones accion)
- [ ] 7.5 Crear componente RollCounters.tsx (contadores de rollo1, rollo2, tickets al pie)
- [ ] 7.6 Implementar logica de boton "Imprimir Normal" (valida limites, dispara venta)
- [ ] 7.7 Implementar logica de boton "Error Impresion" (anulacion de ultima venta)
- [ ] 7.8 Implementar botones de perfil: Filatelia, Protocolo, SPDE
- [ ] 7.9 Implementar boton Reset (limpia cantidades a 0)
- [ ] 7.10 Implementar botones Pausar/Reanudar impresora
- [ ] 7.11 Escribir tests de componente para TariffTable y CartControls
- [ ] 7.12 Verificar flujo completo de venta en la UI (sin impresion real)

## Task 8: Vista Maquina (Configuracion)

- [ ] 8.1 Crear componente CodigoSection.tsx (modo, mes, pais, año, maquina, cliente, producto)
- [ ] 8.2 Crear componente TicketSection.tsx (feria, lugar, empresa, CIF, textos legales, limites, fecha/hora)
- [ ] 8.3 Crear componente RollosSection.tsx (existencias, quitar rollo, instalar rollo, bloqueado/desbloqueado)
- [ ] 8.4 Crear componente TirasSection.tsx (precios tiras especiales, activar/desactivar por modelo)
- [ ] 8.5 Implementar boton Guardar que persiste configuracion via IPC
- [ ] 8.6 Implementar boton Exportar XLS
- [ ] 8.7 Verificar que los cambios guardados se reflejan en la vista Kiosko

## Task 9: Vista Imprimir (Perfiles y Eventos)

- [ ] 9.1 Crear componente PerfilSection.tsx (selector de perfil activo 1-6)
- [ ] 9.2 Crear componente EventoSection.tsx (selector de evento activo 0-7, previsualizacion de modelos)
- [ ] 9.3 Crear componente EventoEditor.tsx (edicion de datos del evento seleccionado)
- [ ] 9.4 Crear componente PerfilesSection.tsx (edicion de nombres de perfiles)
- [ ] 9.5 Crear componente TarifaSection.tsx (edicion de precios por tarifa + plantillas estandar/america/andorra)
- [ ] 9.6 Implementar boton Guardar + Activar que persiste y navega
- [ ] 9.7 Verificar que cambios de evento/perfil se reflejan en Kiosko

## Task 10: Vista Subir Imagen

- [ ] 10.1 Crear componente ImageUpload.tsx con drag&drop y recorte de imagen
- [ ] 10.2 Implementar subida de imagen como base64 via IPC
- [ ] 10.3 Implementar eliminacion de imagen
- [ ] 10.4 Verificar que las imagenes subidas aparecen como fondo en la previsualizacion de Kiosko

## Task 11: Generacion de PDFs

- [ ] 11.1 Instalar pdfkit (o @pdfme/generator) como dependencia
- [ ] 11.2 Copiar fuentes Franklin Gothic a resources/fonts/
- [ ] 11.3 Crear src/main/printing/stamp-renderer.ts (genera PDF etiqueta 55x25mm)
- [ ] 11.4 Implementar variantes de etiqueta: genStampI (con fondo), genStampD (con fondo), genStamp (sin fondo/mdcc)
- [ ] 11.5 Implementar tiras especiales: genStampE1, genStampE2
- [ ] 11.6 Crear src/main/printing/ticket-renderer.ts (genera PDF ticket 78xVARmm)
- [ ] 11.7 Implementar variantes de ticket: genTicket (principal), genTicketCaja (copia), genTicketMaster (master set)
- [ ] 11.8 Crear src/main/printing/pdf-generator.ts (orquesta generacion de todos los PDFs de una venta)
- [ ] 11.9 Escribir tests que verifiquen que se generan los PDFs correctos segun cantidades (Property 7)
- [ ] 11.10 Verificar visualmente que los PDFs generados tienen el layout correcto

## Task 12: Modulo de Impresion

- [ ] 12.1 Crear src/main/printing/printer-manager.ts con interfaz abstracta PrinterBackend
- [ ] 12.2 Implementar CupsBackend (Linux/Ubuntu) con comandos lp, cupsdisable, cupsenable
- [ ] 12.3 Implementar IppBackend (Windows) con protocolo IPP sobre HTTP
- [ ] 12.4 Implementar auto-deteccion de backend segun SO
- [ ] 12.5 Crear src/main/printing/print-queue.service.ts (procesa cola con reintentos)
- [ ] 12.6 Implementar descubrimiento de impresoras (avahi-browse en Linux, escaneo IPP en Windows)
- [ ] 12.7 Escribir tests con mock de impresora (Property 9: enrutamiento correcto)
- [ ] 12.8 Verificar impresion real con impresora Epson en Windows (test manual)

## Task 13: Logica de Venta Completa (Integracion)

- [ ] 13.1 Implementar flujo completo de venta en main process: transaccion atomica (sesion + rollos + ordenes)
- [ ] 13.2 Integrar generacion de PDFs en el flujo de venta
- [ ] 13.3 Integrar envio a impresoras en el flujo de venta
- [ ] 13.4 Implementar anulacion de venta (revert sesion + rollos + registro auditoria)
- [ ] 13.5 Escribir property-based tests para atomicidad (Property 10)
- [ ] 13.6 Escribir property-based tests para round-trip venta/anulacion (Property 4)
- [ ] 13.7 Escribir property-based tests para decremento de rollos (Property 5)
- [ ] 13.8 Verificar flujo completo end-to-end: click en Kiosko -> PDFs generados -> enviados a impresora

## Task 14: Sincronizacion Cloud (Opcional)

- [ ]* 14.1 Crear src/main/sync/connectivity.ts (deteccion de conexion a internet)
- [ ]* 14.2 Crear src/main/sync/sync-engine.ts (envio de sync_log pendientes a API)
- [ ]* 14.3 Implementar descarga de actualizaciones de catalogo desde cloud
- [ ]* 14.4 Implementar conflict-resolver (last-write-wins para ordenes)
- [ ]* 14.5 Escribir property-based tests para idempotencia de sync (Property 13)
- [ ]* 14.6 Verificar sincronizacion manual cuando hay conexion

## Task 15: Build y Empaquetado

- [ ] 15.1 Configurar electron-builder para generar .deb/AppImage (Linux dev)
- [ ] 15.2 Configurar electron-builder para generar .exe NSIS (Windows produccion)
- [ ] 15.3 Configurar auto-arranque con Windows (registro o shortcut en Startup)
- [ ] 15.4 Empaquetar fuentes y recursos en la build final
- [ ] 15.5 Verificar instalacion limpia en Windows desde el .exe generado
- [ ] 15.6 Verificar que la app arranca en < 3 segundos en Windows

## Task 16: Tests Finales y Property-Based Testing

- [ ] 16.1 Escribir property-based tests para exportacion CSV (Property 12)
- [ ] 16.2 Escribir property-based tests para persistencia de config (Property 11)
- [ ] 16.3 Escribir property-based tests para gestion de imagenes (Property 15)
- [ ] 16.4 Escribir property-based tests para bloqueo de evento (Property 6)
- [ ] 16.5 Escribir property-based tests para titulo de ticket segun perfil (Property 8)
- [ ] 16.6 Ejecutar suite completa de tests y verificar que todas las properties pasan
- [ ] 16.7 Test manual completo en Windows con impresora Epson: venta -> impresion -> anulacion -> exportacion
