# Plan de Implementación: Distribución y licenciamiento en AWS

## Visión general

Esta entrega cubre **únicamente la Fase 0** del plan por fases del diseño: el Documento_Arquitectura en `docs/distribucion-aws.md`, en español, y —de forma opcional— los módulos **puros y autocontenidos** que fijan el formato de los documentos firmados y las decisiones locales del Cliente_Escritorio, cada uno con su prueba basada en propiedades.

Reglas que gobiernan todo el plan:

- **El comportamiento actual de la aplicación no cambia.** Ninguna tarea modifica ficheros existentes. No se añaden pantallas de activación, ni comprobaciones de licencia, ni dependencias de red, ni llamadas desde `src/main/index.ts` ni desde `src/main/ipc/handlers.ts`. Los 18 puntos de contacto que el diseño enumera quedan intactos en esta entrega.
- **Solo ficheros nuevos.** Los módulos van bajo `src/main/licencia/`, `src/main/actualizacion/`, `src/main/sincronizacion/` y `src/main/permisos/`, con sus pruebas en el `__tests__/` de cada directorio.
- **Módulos puros.** Sin red, sin SQLite, sin `electron`, sin `Date.now()` directo: el reloj y el cifrado del sistema operativo entran como parámetros. Nadie los invoca desde el flujo de venta.
- **Lenguaje: TypeScript**, el del proyecto. Pruebas con **Vitest + fast-check** (ya en `devDependencies`), sufijo `.property.test.ts`, mínimo `{ numRuns: 100 }` y comentario de cabecera con el formato `Feature: aws-distribution-licensing, Property {n}: {texto de la propiedad}`.
- **Una sola prueba basada en propiedades por propiedad de diseño.**
- Las Fases 1 a 7 quedan **diferidas**. Su frontera se documenta al final de este plan; no hay tareas de implementación para ellas.

## Tareas

- [ ] 1. Redactar el Documento_Arquitectura en `docs/distribucion-aws.md`
  - [ ] 1.1 Crear el documento con su introducción, glosario y alcance
    - Crear `docs/distribucion-aws.md` en español, con el estilo de los documentos existentes de `docs/`
    - Introducción: los cinco objetivos (distribuir, preservar el funcionamiento offline, licenciar por máquina, diferenciar permisos, personalizar por Identidad_Cliente)
    - Glosario de términos del negocio: Cliente_Escritorio, Equipo_Autorizado, Huella_Hardware, Licencia, Clave_Licencia, Activacion_Licencia, Token_Licencia, Servicio_Licencias, Periodo_Gracia_Offline, Portal_Descargas, Enlace_Temporal, Artefacto_Instalador, Canal_Liberacion, Manifiesto_Actualizacion, Actualizador_Cliente, Version_Fijada, Paquete_Contenido, Configuracion_Remota, Identidad_Cliente, Paquete_Marca, Instalador_Neutro, Sincronizador_Remoto, Rol_Propietario, Rol_Operador, Perfil_Permisos, Guardia_Permisos, Registro_Auditoria, Cadena_Compilacion
    - Dimensionamiento previsto: de 4 a 50 clientes, de 1 a 3 equipos por cliente, hasta 150 Equipo_Autorizado, una Licencia por equipo
    - Las cuatro decisiones estructurales: AWS como origen de publicación y nunca base de datos de consulta; un solo Instalador_Neutro por versión; sin credenciales de AWS en el equipo; todo lo que decide comportamiento va firmado
    - _Requisitos: 19.1_

  - [ ] 1.2 Documentar los componentes de AWS empleados
    - Tabla de servicios con su papel: S3, CloudFront con grupo de claves de confianza, API Gateway HTTP API, Lambda, DynamoDB en modo bajo demanda, KMS con las dos claves ECC_NIST_P256, CloudWatch Logs, AWS Budgets, CDK en `infra/`
    - Diagrama Mermaid de componentes, tomado del diseño
    - Justificación de cada elección y alternativas descartadas, en particular por qué no Cognito y por qué cookies firmadas de CloudFront en lugar de URL prefirmadas de S3
    - Región elegida (eu-south-2) y motivo
    - _Requisitos: 19.2, 18.5_

  - [ ] 1.3 Documentar los cinco flujos
    - Flujo de publicación de una versión, con su diagrama de secuencia
    - Flujo de activación de licencia, incluida la activación manual sin red y la preinstalación con activación previa a la entrega
    - Flujo de actualización, con la decisión de versión objetivo antes de delegar en electron-updater
    - Flujo de sincronización de contenido, con la escritura transaccional en SQLite y la convivencia con la carga desde `bbdd-ferias`
    - Flujo de personalización por Identidad_Cliente: qué llega del Paquete_Marca, del Paquete_Contenido y de la Configuracion_Remota, y cómo se aplica al ticket y a la etiqueta
    - En cada flujo, indicar de forma explícita qué ocurre cuando no hay red
    - _Requisitos: 19.2_

  - [ ] 1.4 Documentar los procedimientos operativos
    - Publicación de una versión: etiqueta, compilación, cálculo de sumas, subida, verificación posterior a la subida, firma del manifiesto, invalidación de caché y registro de la publicación
    - Retorno a una versión anterior de un Canal_Liberacion mediante la orden de retorno
    - Alta de un cliente con su Paquete_Marca, su Paquete_Contenido y su Configuracion_Remota iniciales, y emisión de una Clave_Licencia por equipo
    - Traspaso de una licencia entre equipos: liberación de la Activacion_Licencia y activación en el equipo nuevo
    - Revocación y suspensión de una licencia, con su efecto sobre descargas, activaciones y revalidaciones
    - Cada procedimiento con sus pasos numerados, quién lo ejecuta y cómo se comprueba que ha salido bien
    - _Requisitos: 19.3_

  - [ ] 1.5 Documentar el procedimiento de alta de la cuenta de AWS
    - Creación de una cuenta dedicada al negocio, separada de cualquier cuenta personal
    - Activación de la autenticación multifactor en el usuario raíz y retirada del raíz del uso cotidiano
    - Creación de identidades con permisos limitados a los recursos de distribución
    - Configuración del presupuesto mensual con alerta por correo al 80 %
    - Elección de región y separación de los entornos `pruebas` y `produccion` por prefijos
    - _Requisitos: 18.8, 18.1, 18.2, 18.3, 18.4, 18.7_

  - [ ] 1.6 Documentar la verificación manual del instalador y el aviso de SmartScreen
    - Procedimiento paso a paso de comprobación de la suma SHA-256 del Artefacto_Instalador descargado, con el comando concreto de Windows y cómo comparar el resultado con `SHA256SUMS`
    - Qué verá la persona que instale mientras no exista certificado de firma de código: aviso de SmartScreen, cómo continuar y cómo distinguir ese aviso de un artefacto realmente sospechoso
    - Qué cambia el día que exista certificado: firma del ejecutable y `verifyUpdateCodeSignature`
    - Requisito de `electron-updater` en `^6.3.0` o superior y motivo (CVE-2024-39698)
    - _Requisitos: 3.7, 3.8, 3.5_

  - [ ] 1.7 Incluir la tabla de diagnóstico
    - Una fila por síntoma, con su causa probable y su acción correctiva
    - Cubrir todos los estados de Licencia (`activa`, `suspendida`, `revocada`, `expirada`), el agotamiento del Periodo_Gracia_Offline, el reloj retrocedido, la Huella_Hardware no coincidente y el descifrado local imposible
    - Cubrir los errores de sincronización: suma de verificación discrepante de una imagen, Identidad_Cliente que no corresponde, parámetro no aplicado por `camposLocales` o por versión no superior, interrupción a mitad de escritura
    - Cubrir los errores de actualización: Version_Fijada por debajo de la publicada, canal distinto, venta en curso, firma del manifiesto inválida, 403 al descargar
    - _Requisitos: 19.4_

  - [ ] 1.8 Incluir la estimación de costes mensuales
    - Tabla con el coste mensual estimado por servicio de AWS para 150 Equipo_Autorizado y 12 publicaciones al año, con el supuesto de volumen de cada línea
    - Total agregado y margen frente al objetivo de 15 EUR mensuales
    - Qué mueve el coste al alza (salida de CloudFront fuera de la capa gratuita, mes de publicación) y cómo se vigila con AWS Budgets
    - Regla de ciclo de vida a los 180 días como palanca de coste del almacenamiento
    - _Requisitos: 19.5, 17.2, 17.3, 17.4, 17.5_

  - [ ] 1.9 Comparar las dos modalidades de entrega al cliente
    - Entrega del Artefacto_Instalador frente a entrega del equipo con la aplicación preinstalada
    - Impacto de cada modalidad en la firma de código, en la activación de licencia y en el soporte posterior
    - Cuándo conviene cada una y qué procedimiento operativo le corresponde
    - _Requisitos: 19.6_

  - [ ] 1.10 Incluir el mapa de requisitos a fases de implementación
    - Tabla que asigna cada uno de los 19 requisitos a su fase, de la 0 a la 7
    - Indicar de forma explícita que la Fase 0 es la única que se ejecuta en esta entrega y qué queda diferido
    - _Requisitos: 19.7_

  - [ ] 1.11 Incluir los puntos de contacto en el código actual y la nota de mantenimiento
    - Tabla con los 18 puntos de contacto del diseño: qué cambiará en cada uno y en qué fase
    - Advertencia expresa de que ninguno de esos ficheros se modifica en esta entrega
    - Nota de mantenimiento: cuando la arquitectura de distribución cambie, el documento se actualiza en la misma entrega
    - _Requisitos: 19.8, 19.9_

- [ ] 2. Punto de control del documento
  - Comprobar que el Documento_Arquitectura cubre los nueve criterios del Requisito 19, el 18.8 y el 3.7, y que no se ha modificado ningún fichero existente del proyecto. Resolver las dudas con el usuario si surgen.

- [ ] 3. Módulos puros de análisis y serialización de documentos firmados
  - [ ]* 3.1 Implementar el Serializador_Token y el Analizador_Token
    - Crear `src/main/licencia/token.serializer.ts` y `src/main/licencia/token.parser.ts`
    - Estructura JWS compacta con `alg: ES256` y `kid`, y los campos del diseño: `esquema`, `iss`, `aud`, `sub`, `jti`, `iat`, `exp`, `emitido`, `huella` con su valor agregado y sus tres partes, `licencia`, `cliente`, `permisos` y `extras`
    - Verificación de firma sobre los bytes recibidos antes de analizar, con la clave pública inyectada como parámetro
    - `exp` como mínimo entre la expiración de la Licencia e `iat` más 35 días
    - Funciones puras: ni red, ni SQLite, ni `electron`
    - _Requisitos: 14.1, 14.3, 6.3, 11.1_

  - [ ]* 3.2 Escribir la prueba de propiedad de ida y vuelta del Token_Licencia
    - **Propiedad 1: Ida y vuelta del Token_Licencia**
    - **Valida: Requisitos 14.1, 14.3, 14.4, 6.3, 6.9, 11.1**
    - Fichero: `src/main/licencia/__tests__/token.property.test.ts`
    - Par de claves ECC P-256 de pruebas generado en el propio fichero; nunca la clave de KMS
    - Cubrir el token que entra por activación en línea y el pegado a mano

  - [ ]* 3.3 Implementar el analizador y serializador del Manifiesto_Actualizacion
    - Crear `src/main/actualizacion/manifiesto.parser.ts`
    - Campos del diseño: `esquema`, `canal`, `generado`, `versionVigente`, `ordenRetorno`, `versiones[]` con `version`, `plataforma`, `arquitectura`, `ruta`, `tamano`, `sha256`, `publicado`, `minimaVersionOrigen`, y `extras`
    - Verificación de la firma separada (`.sig`) antes del análisis, con la clave pública inyectada
    - _Requisitos: 14.5, 3.3_

  - [ ]* 3.4 Escribir la prueba de propiedad de ida y vuelta del Manifiesto_Actualizacion
    - **Propiedad 2: Ida y vuelta del Manifiesto_Actualizacion**
    - **Valida: Requisitos 14.5**
    - Fichero: `src/main/actualizacion/__tests__/manifiesto.property.test.ts`
    - Generador de versiones semánticas con orden no lexicográfico (1.10.0 frente a 1.9.0)

  - [ ]* 3.5 Implementar los analizadores de los documentos de contenido versionados
    - Crear `src/main/sincronizacion/indice-contenido.parser.ts`, `src/main/sincronizacion/marca.parser.ts` y `src/main/sincronizacion/configuracion-remota.parser.ts`
    - Índice de Paquete_Contenido con `nombre`, `anio`, `feria`, `tipo` (`fondo` \| `sello`), `bytes`, `sha256` y `ruta` por imagen, alineado con los nombres que ya produce `sync-images.ts` (sin modificar ese fichero)
    - Paquete_Marca con `version`, `comercial`, `textosTicket` y `logotipos[]` con su `uso`, `ruta`, `sha256` y `bytes`
    - Configuracion_Remota con `parametros.ticket`, `parametros.codigo`, `gruposTarifas`, `kiosko`, `camposLocales`, `extension` y `extras`, reproduciendo los nombres de `TicketConfig` y `CodigoConfig`
    - _Requisitos: 14.6, 12.3, 13.4, 13.11_

  - [ ]* 3.6 Escribir la prueba de propiedad de ida y vuelta de los documentos de contenido
    - **Propiedad 3: Ida y vuelta de los documentos de contenido versionados**
    - **Valida: Requisitos 14.6, 12.3, 13.4**
    - Fichero: `src/main/sincronizacion/__tests__/documentos-contenido.property.test.ts`
    - Generadores con listas vacías, imágenes repetidas, tamaños grandes, acentos y textos largos

  - [ ]* 3.7 Implementar la fusión de documentos con preservación de campos
    - Crear `src/main/sincronizacion/fusion-documentos.ts`
    - Volcado de la bolsa `extras` a la raíz al reserializar, para que un campo no previsto por el esquema no se pierda
    - Aplicación de un documento sobre un estado local que respeta las rutas enumeradas en `camposLocales`
    - Función pura sobre objetos planos: no escribe en SQLite
    - _Requisitos: 14.7, 12.11, 13.11_

  - [ ]* 3.8 Escribir la prueba de propiedad de preservación de campos desconocidos y locales
    - **Propiedad 4: Preservación de campos desconocidos y de campos locales**
    - **Valida: Requisitos 14.7, 12.11, 13.11**
    - Fichero: `src/main/sincronizacion/__tests__/fusion-documentos.property.test.ts`
    - Generar campos desconocidos anidados y `camposLocales` que apuntan a rutas existentes e inexistentes

  - [ ]* 3.9 Implementar la señalización de errores de análisis
    - Añadir a los analizadores de 3.1, 3.3 y 3.5 un tipo de error común que identifique el campo obligatorio ausente o la comprobación fallida (firma, esquema, tipo de dato)
    - Nunca devolver un objeto de estado parcial: el resultado es documento válido o error descriptivo
    - Códigos de error estables y sin valores de secretos en el mensaje
    - _Requisitos: 14.2_

  - [ ]* 3.10 Escribir la prueba de propiedad de señalización de errores
    - **Propiedad 5: Señalización de errores en el análisis**
    - **Valida: Requisitos 14.2**
    - Fichero: `src/main/licencia/__tests__/analisis-errores.property.test.ts`
    - Partir de documentos válidos y eliminar un campo obligatorio, alterar un byte del cuerpo o alterar un byte de la firma

  - [ ]* 3.11 Implementar la monotonía de versiones de los documentos versionados
    - Añadir a `src/main/sincronizacion/fusion-documentos.ts` la fusión por número de versión para Perfil_Permisos, Configuracion_Remota, Paquete_Marca y Paquete_Contenido
    - Conservar siempre el documento de versión más alta entre el almacenado y el recibido, con resultado idempotente
    - _Requisitos: 11.5, 11.6, 12.9, 13.6, 13.7_

  - [ ]* 3.12 Escribir la prueba de propiedad de monotonía de versiones
    - **Propiedad 6: Monotonía de versiones de los documentos versionados**
    - **Valida: Requisitos 11.5, 11.6, 12.9, 13.6, 13.7**
    - Fichero: `src/main/sincronizacion/__tests__/monotonia-versiones.property.test.ts`
    - Generar versiones iguales, inferiores y superiores, y comprobar que aplicar la fusión dos veces da el mismo resultado que aplicarla una vez

- [ ] 4. Punto de control de los documentos firmados
  - Ejecutar `npm run test` y `npm run typecheck`, y comprobar que ningún fichero existente ha cambiado. Resolver las dudas con el usuario si surgen.

- [ ] 5. Módulos puros de Huella_Hardware, cifrado local y estado de licencia
  - [ ]* 5.1 Implementar la derivación y la comparación de la Huella_Hardware
    - Crear `src/main/licencia/huella.ts`
    - Normalización de cada componente (minúsculas, sin espacios ni separadores, vacío o ilegible → `NO_DISPONIBLE`) y derivación `h1`, `h2`, `h3` con `SAL_PRODUCTO`, más la huella agregada SHA-256 con orden fijo
    - Comparación tolerante 2 de 3: un componente no disponible nunca cuenta como coincidencia
    - Los tres identificadores de hardware entran como parámetros; el módulo no los lee del sistema
    - _Requisitos: 8.1, 8.6, 8.8_

  - [ ]* 5.2 Escribir la prueba de propiedad de tolerancia 2 de 3
    - **Propiedad 7: Tolerancia 2 de 3 de la Huella_Hardware**
    - **Valida: Requisitos 8.6, 8.2**
    - Fichero: `src/main/licencia/__tests__/huella.property.test.ts`
    - Generar componentes iguales, distintos, `NO_DISPONIBLE`, con espacios, con mayúsculas y vacíos, incluido el caso de dos componentes no disponibles en ambos lados

  - [ ]* 5.3 Implementar la envoltura triple de cifrado local
    - Crear `src/main/licencia/sobre-licencia.ts`
    - Clave de contenido aleatoria, contenido con AES-256-GCM, tres envolturas con `KEK_i` derivada por HKDF-SHA256 de cada componente de la huella
    - La capa externa del sistema operativo entra como puerto inyectado (interfaz de cifrado de cadena), sin importar `electron`: en las pruebas se inyecta un doble
    - Descifrado que recupera el contenido con cualquier envoltura que se abra, y error explícito cuando ninguna abre
    - _Requisitos: 8.4, 8.5_

  - [ ]* 5.4 Escribir la prueba de propiedad de la envoltura triple
    - **Propiedad 8: Ida y vuelta del cifrado local con envoltura triple**
    - **Valida: Requisitos 8.4, 8.5**
    - Fichero: `src/main/licencia/__tests__/sobre-licencia.property.test.ts`
    - Barrer las combinaciones de componentes presentes y ausentes, incluida la de ninguna envoltura abrible

  - [ ]* 5.5 Implementar el cálculo del estado de licencia y del Periodo_Gracia_Offline
    - Crear `src/main/licencia/gracia.ts`
    - Entrada: estado de la Licencia, fecha de emisión del token, fecha de última revalidación correcta, Periodo_Gracia_Offline e instante actual inyectado
    - Salida: modo (`normal` \| `restringido`), aviso a partir del 80 % con los días restantes, y motivo de la restricción
    - Gracia fuera del intervalo de 1 a 180 días rechazada en favor del valor por defecto de 30 días; instante actual anterior a la emisión tratado como gracia agotada
    - Sin `Date.now()`: el reloj se inyecta
    - _Requisitos: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 5.6 Escribir la prueba de propiedad de la frontera del Periodo_Gracia_Offline
    - **Propiedad 9: Frontera del Periodo_Gracia_Offline**
    - **Valida: Requisitos 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**
    - Fichero: `src/main/licencia/__tests__/gracia.property.test.ts`
    - Generar las fronteras exactas del 80 % y del 100 %, instantes anteriores a la emisión y cambios de horario de verano

  - [ ]* 5.7 Implementar el conjunto de operaciones disponibles en modo restringido
    - Crear `src/main/licencia/modo-restringido.ts`
    - Función pura que, dado el estado de licencia, devuelve qué operaciones están disponibles: consulta y exportación de pedidos ya registrados sí, registro de ventas nuevas no
    - Módulo autónomo: no se llama desde `sale.handlers.ts` ni desde ningún canal IPC en esta entrega
    - _Requisitos: 7.6_

  - [ ]* 5.8 Escribir la prueba de propiedad de las operaciones en modo restringido
    - **Propiedad 10: Operaciones disponibles en modo restringido**
    - **Valida: Requisitos 7.6**
    - Fichero: `src/main/licencia/__tests__/modo-restringido.property.test.ts`

- [ ] 6. Punto de control de licencia local
  - Ejecutar `npm run test` y `npm run typecheck`, y comprobar que ningún fichero existente ha cambiado. Resolver las dudas con el usuario si surgen.

- [ ] 7. Módulos puros de política de actualización
  - [ ]* 7.1 Implementar la política de versión objetivo
    - Crear `src/main/actualizacion/politica-version.ts`
    - Entrada: versión instalada, Manifiesto_Actualizacion, Canal_Liberacion asignado al equipo, Version_Fijada y orden de retorno
    - Salida: versión objetivo o ausencia de objetivo, siempre del canal asignado, nunca superior a la Version_Fijada, superior a la instalada salvo orden de retorno
    - Comparación semántica de versiones, no lexicográfica
    - _Requisitos: 1.3, 5.3, 5.8, 5.9_

  - [ ]* 7.2 Escribir la prueba de propiedad de la política de versión objetivo
    - **Propiedad 13: Política de versión objetivo**
    - **Valida: Requisitos 1.3, 5.3, 5.8, 5.9**
    - Fichero: `src/main/actualizacion/__tests__/politica-version.property.test.ts`
    - Generar versiones con orden no lexicográfico, prerelease, igualdad y órdenes de retorno, y manifiestos con versiones de varios canales

  - [ ]* 7.3 Implementar la retención de versiones por Canal_Liberacion
    - Crear `src/main/actualizacion/retencion-canal.ts`
    - Función pura que, dado un historial de versiones publicadas en cualquier orden de llegada, devuelve el conjunto conservado: la versión vigente y al menos las tres anteriores del mismo canal, sin versiones de otros canales
    - _Requisitos: 1.4_

  - [ ]* 7.4 Escribir la prueba de propiedad de retención de versiones por canal
    - **Propiedad 14: Retención de versiones por canal**
    - **Valida: Requisitos 1.4**
    - Fichero: `src/main/actualizacion/__tests__/retencion-canal.property.test.ts`
    - Generar historiales desordenados y mezclas de canales `estable`, `beta` y `piloto`

- [ ] 8. Módulo puro del plan de sincronización
  - [ ]* 8.1 Implementar el cálculo del plan de sincronización
    - Crear `src/main/sincronizacion/plan-sincronizacion.ts`
    - Entrada: índice de Paquete_Contenido remoto y estado local de imágenes con sus sumas de verificación
    - Salida: exactamente las imágenes ausentes en local o con suma SHA-256 distinta, en un plan reanudable
    - Función pura: recibe el estado local como parámetro, no consulta SQLite
    - _Requisitos: 12.6, 12.7_

  - [ ]* 8.2 Escribir la prueba de propiedad del plan de sincronización
    - **Propiedad 19: Plan de sincronización mínimo e idempotente**
    - **Valida: Requisitos 12.6, 12.7**
    - Fichero: `src/main/sincronizacion/__tests__/plan-sincronizacion.property.test.ts`
    - Comprobar que volver a planificar tras aplicar el plan completo produce un plan vacío; generar índices vacíos, imágenes repetidas y sumas alteradas

- [ ] 9. Módulos puros de permisos y sesión
  - [ ]* 9.1 Implementar el analizador del Perfil_Permisos y el Guardia_Permisos
    - Crear `src/main/permisos/perfil.parser.ts` y `src/main/permisos/guardia.ts`
    - Perfil con `esquema`, `version`, `roles.propietario.acciones`, `roles.operador.acciones`, bloque `elevacion` y `extras`
    - `autoriza(accion, rol, perfil)` devuelve un veredicto puro con `permitido` y, en caso de denegación, la entrada de Registro_Auditoria que corresponde (operación, rol y fecha inyectada), sin escribirla
    - Perfil cuya firma no verifica se degrada al conjunto de acciones del Rol_Operador
    - No se añade el parámetro `accion` a `handleIpc` ni se toca ningún canal existente en esta entrega
    - _Requisitos: 10.2, 10.3, 10.4, 10.12, 11.3, 11.4_

  - [ ]* 9.2 Escribir la prueba de propiedad de la decisión del Guardia_Permisos
    - **Propiedad 23: Decisión del Guardia_Permisos**
    - **Valida: Requisitos 10.2, 10.3, 10.4, 10.12, 11.3, 11.4**
    - Fichero: `src/main/permisos/__tests__/guardia.property.test.ts`
    - Comprobar la disyunción de los conjuntos de acciones de Rol_Propietario y Rol_Operador, la entrada de auditoría única por denegación y la degradación por firma inválida

  - [ ]* 9.3 Implementar la máquina de estados de la sesión
    - Crear `src/main/permisos/sesion.ts`
    - Reductor puro sobre los estados Operador, Propietario y Bloqueado, con eventos de elevación, intento de PIN incorrecto, actividad y avance del reloj
    - Arranque en Rol_Operador, bloqueo de 15 minutos tras 5 intentos incorrectos consecutivos, retorno a Rol_Operador tras 15 minutos sin actividad
    - Reloj inyectado; el contador y la marca de bloqueo se devuelven como parte del estado, sin persistirlos en SQLite en esta entrega
    - _Requisitos: 10.1, 10.7, 10.10, 10.11_

  - [ ]* 9.4 Escribir la prueba de propiedad de la máquina de estados de la sesión
    - **Propiedad 25: Máquina de estados de la sesión**
    - **Valida: Requisitos 10.1, 10.7, 10.10, 10.11**
    - Fichero: `src/main/permisos/__tests__/sesion.property.test.ts`
    - Generar secuencias arbitrarias de eventos y avances del reloj, y comprobar que en todo momento hay exactamente un rol

  - [ ]* 9.5 Implementar la elevación mediante PIN de propietario
    - Añadir a `src/main/permisos/sesion.ts` la verificación y el cambio del PIN
    - Derivación PBKDF2-SHA256 con sal y 210 000 iteraciones, comparada contra el valor del bloque `elevacion` del Perfil_Permisos
    - Longitud mínima de 6 dígitos; el cambio de PIN exige el PIN vigente correcto
    - El valor en claro nunca se guarda ni aparece en el documento serializado
    - _Requisitos: 10.8, 10.9, 10.13_

  - [ ]* 9.6 Escribir la prueba de propiedad de la elevación mediante PIN
    - **Propiedad 26: Elevación mediante PIN de propietario**
    - **Valida: Requisitos 10.8, 10.9, 10.13**
    - Fichero: `src/main/permisos/__tests__/elevacion-pin.property.test.ts`
    - Comprobar que el documento serializado no contiene en ningún caso el valor del PIN en claro

- [ ] 10. Punto de control final de la Fase 0
  - Ejecutar `npm run test` y `npm run typecheck`
  - Comprobar que el árbol de cambios solo contiene ficheros nuevos: `docs/distribucion-aws.md` y los módulos y pruebas de `src/main/licencia/`, `src/main/actualizacion/`, `src/main/sincronizacion/` y `src/main/permisos/`
  - Comprobar que ninguno de los 18 puntos de contacto del diseño ha sido modificado, en particular `src/main/index.ts` y `src/main/ipc/handlers.ts`
  - Resolver las dudas con el usuario si surgen

## Frontera de fases

Lo que sigue **no forma parte de esta entrega** y no tiene tareas en este plan. Cada fase requiere su propia especificación o una pasada posterior sobre esta, cuando exista la cuenta de AWS y la interfaz esté estable.

| Fase diferida | Contenido | Requisitos | Propiedades pendientes |
| --- | --- | --- | --- |
| 1. Cuenta y base de AWS | Cuenta dedicada, MFA, identidades, presupuesto, región, pila de CDK con los dos entornos, buckets, CloudFront, KMS, DynamoDB | 18, 17 | 36 |
| 2. Publicación de versiones | `scripts/publicar-version.ts`, rol OIDC, firma del manifiesto, retención por canal, auditoría de publicación | 1; 3.1–3.4 | 17 (14 ya en Fase 0) |
| 3. Servicio_Licencias | API HTTP, autorizador, activación, revalidación, liberación, suspensión, revocación, administración de clientes y claves | 6, 7, 9, 2; 16.6, 16.8 | 28, 29, 30, 31, 32 |
| 4. Licencia en el cliente | Pantalla de activación, almacén cifrado real, planificador de segundo plano, modo restringido efectivo, indicador de conectividad, migración `010_distribucion_licencia.sql` | 4, 8, 15 | 11, 12, 33 |
| 5. Actualizador_Cliente | electron-updater con proveedor genérico, verificación de suma y de firma, Version_Fijada, orden de retorno, aplazamiento por venta en curso | 5; 3.5, 3.6 | 15, 16, 18 |
| 6. Sincronizador_Remoto y personalización | Descarga y escritura transaccional de Paquete_Marca, Paquete_Contenido y Configuracion_Remota, convivencia con `bbdd-ferias`, Instalador_Neutro | 12, 13 | 20, 21, 22, 27, 35 |
| 7. Roles y auditoría | Sesión con PIN cableada, Guardia_Permisos sobre los canales protegidos, ocultación de controles, Registro_Auditoria local y envío por lotes | 10, 11, 16 | 24, 34 |

Las Fases 1 a 3 no tocan el código de la aplicación y pueden avanzar en paralelo al desarrollo funcional y visual en curso. Las Fases 4 a 7 sí lo tocan: es el momento en que los 18 puntos de contacto documentados en la tarea 1.11 dejan de ser una lista y pasan a ser cambios reales.

## Notas

- Las subtareas marcadas con `*` son opcionales. La tarea 1 y sus subtareas son el entregable comprometido de esta especificación; el resto fija los formatos y las decisiones locales antes de construir la infraestructura, y puede omitirse sin bloquear las fases siguientes.
- Cada tarea referencia los criterios de aceptación concretos que aborda, y cada prueba basada en propiedades referencia el número de propiedad del documento de diseño.
- Ninguna tarea modifica ficheros existentes ni altera el comportamiento actual de la aplicación.
- Las propiedades de la Fase 0 que quedan cubiertas aquí son la 1 a la 10, la 13, la 14, la 19, la 23, la 25 y la 26. Las demás dependen de infraestructura o de código con efectos y se abordan en su fase.
- Las pruebas criptográficas usan un par de claves ECC P-256 generado en el propio fichero de prueba. Nunca una clave de KMS.
- Las pruebas con dimensión temporal (propiedades 9, 25) usan un reloj inyectado, no `Date.now()`, para que las fronteras sean deterministas.
