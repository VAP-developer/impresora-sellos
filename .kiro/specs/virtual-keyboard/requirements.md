# Requirements Document: Teclado Virtual

## Introducción

Esta funcionalidad añade un teclado virtual en pantalla a la aplicación Stamp Sales para permitir su uso en dispositivos táctiles (tablets, pantallas táctiles, kioscos) sin necesidad de teclado físico. El teclado se presenta en dos variantes (numérico reducido y QWERTY completo) con soporte para dos idiomas (español e inglés), y puede activarse/desactivarse desde la configuración.

## Glosario

- **Virtual_Keyboard**: Componente de teclado en pantalla que permite la entrada de texto/números mediante clics o toques táctiles
- **Numeric_Keypad**: Variante reducida del teclado virtual que muestra solo dígitos 0-9, borrar y confirmar
- **Full_Keyboard**: Variante completa del teclado con layout QWERTY, números, caracteres especiales y teclas de control
- **Keyboard_Layout_ES**: Layout de teclado en español que incluye Ñ, acentos y caracteres específicos del idioma
- **Keyboard_Layout_EN**: Layout de teclado en inglés QWERTY estándar
- **Keyboard_Provider**: Contexto React que gestiona el estado global del teclado (visible/oculto, input activo, tipo)
- **Active_Input**: El campo de entrada (`<input>`) que actualmente tiene el foco y recibirá las pulsaciones del teclado virtual
- **Keyboard_Setting**: Configuración persistente que activa/desactiva el teclado virtual y selecciona el idioma del layout
- **Touch_Mode**: Estado de la aplicación cuando el teclado virtual está activado

## Requisitos

### Requisito 1: Activación/Desactivación en Configuración

**Historia de Usuario:** Como usuario, quiero poder activar o desactivar el teclado virtual desde la pantalla de configuración, para poder elegir si usar el teclado en pantalla o un teclado físico según mi dispositivo.

#### Criterios de Aceptación

1. EN la vista de Configuración (SettingsView) EXISTIRÁ una nueva sección colapsable titulada "TECLADO VIRTUAL"
2. LA sección CONTENDRÁ un interruptor (toggle/switch) para activar/desactivar el teclado virtual
3. CUANDO el teclado virtual esté desactivado, NINGÚN teclado en pantalla aparecerá al hacer foco en inputs
4. CUANDO el teclado virtual esté activado, el teclado aparecerá automáticamente al hacer foco en campos de entrada
5. LA configuración SE PERSISTIRÁ en la base de datos SQLite mediante el canal IPC existente (config)
6. AL reiniciar la aplicación, la configuración del teclado virtual SE RESTAURARÁ al último estado guardado
7. EL estado por defecto del teclado virtual SERÁ desactivado

### Requisito 2: Selección de Idioma del Teclado

**Historia de Usuario:** Como usuario, quiero poder elegir entre un teclado en español (con Ñ) y uno en inglés (QWERTY estándar), para poder escribir cómodamente en mi idioma.

#### Criterios de Aceptación

1. EN la sección "TECLADO VIRTUAL" de Configuración EXISTIRÁ un selector de idioma con dos opciones: Español e Inglés
2. EL selector de idioma SOLO SERÁ visible/editable cuando el teclado virtual esté activado
3. CUANDO se seleccione Español, el teclado completo MOSTRARÁ layout con Ñ entre L y tecla Enter, y acentos (á, é, í, ó, ú)
4. CUANDO se seleccione Inglés, el teclado completo MOSTRARÁ layout QWERTY estándar sin Ñ
5. EL teclado numérico NO SE VERÁ afectado por la selección de idioma (los dígitos son universales)
6. LA selección de idioma SE PERSISTIRÁ junto con el estado de activación
7. EL idioma por defecto del teclado SERÁ Español

### Requisito 3: Teclado Numérico Reducido

**Historia de Usuario:** Como operador del kiosko, quiero un teclado numérico compacto cuando edito cantidades de sellos, para poder introducir números rápidamente sin que el teclado ocupe mucho espacio en pantalla.

#### Criterios de Aceptación

1. EL teclado numérico MOSTRARÁ los dígitos 0-9 en disposición de calculadora (7-8-9 / 4-5-6 / 1-2-3 / 0)
2. EL teclado numérico INCLUIRÁ un botón de borrar (⌫) para eliminar el último dígito
3. EL teclado numérico INCLUIRÁ un botón de confirmar/cerrar (✓) para ocultar el teclado
4. EL teclado numérico INCLUIRÁ un botón de limpiar (C) para vaciar el campo a 0
5. EL teclado numérico SE MOSTRARÁ automáticamente cuando un campo `<input type="number">` reciba el foco
6. EL teclado numérico SE POSICIONARÁ cerca del input activo sin tapar el campo que se está editando
7. EL teclado numérico TENDRÁ un tamaño compacto (máximo 200x250px) para no obstruir la vista del kiosko
8. LAS teclas del teclado numérico TENDRÁN un tamaño mínimo de 44x44px para ser fácilmente pulsables con el dedo

### Requisito 4: Teclado Completo QWERTY

**Historia de Usuario:** Como usuario, quiero un teclado completo cuando edito campos de texto (nombres de eventos, códigos, etc.), para poder escribir cualquier carácter necesario.

#### Criterios de Aceptación

1. EL teclado completo MOSTRARÁ un layout QWERTY con todas las letras del alfabeto
2. EL teclado completo INCLUIRÁ una fila de números (1-0) en la parte superior
3. EL teclado completo INCLUIRÁ tecla de Shift/Mayúsculas con indicador visual del estado activo
4. EL teclado completo INCLUIRÁ tecla de Espacio (barra espaciadora)
5. EL teclado completo INCLUIRÁ tecla de Borrar (⌫/Backspace)
6. EL teclado completo INCLUIRÁ tecla de Enter/Confirmar
7. EL teclado completo INCLUIRÁ caracteres especiales comunes: punto (.), coma (,), guión (-), barra (/), arroba (@)
8. EL teclado completo SE MOSTRARÁ automáticamente cuando un campo `<input type="text">` o `<input>` sin type reciba el foco
9. EL teclado completo SE POSICIONARÁ en la parte inferior de la pantalla (fijo)
10. EL teclado completo OCUPARÁ el ancho completo de la ventana para maximizar el tamaño de las teclas
11. LAS teclas TENDRÁN un tamaño mínimo de 40x44px para uso táctil
12. EL contenido de la vista SE DESPLAZARÁ hacia arriba si el teclado oculta el input activo

### Requisito 5: Detección Automática del Tipo de Teclado

**Historia de Usuario:** Como usuario, quiero que el sistema muestre automáticamente el tipo de teclado correcto según el campo en el que estoy escribiendo, sin tener que seleccionarlo manualmente.

#### Criterios de Aceptación

1. CUANDO un campo `<input type="number">` reciba el foco, SE MOSTRARÁ el teclado numérico
2. CUANDO un campo `<input type="text">` reciba el foco, SE MOSTRARÁ el teclado completo
3. CUANDO un campo `<input>` sin atributo type reciba el foco, SE MOSTRARÁ el teclado completo
4. CUANDO el usuario toque fuera del teclado y fuera de cualquier input, EL TECLADO SE OCULTARÁ
5. CUANDO el usuario pulse la tecla de confirmar/Enter del teclado, EL TECLADO SE OCULTARÁ
6. CUANDO el input activo pierda el foco (blur) por navegación programática, EL TECLADO SE OCULTARÁ
7. EL cambio de tipo de teclado (numérico ↔ completo) SERÁ instantáneo al cambiar de campo

### Requisito 6: Integración con la Vista Kiosko

**Historia de Usuario:** Como operador del kiosko, quiero que el teclado numérico funcione perfectamente con los campos de cantidad de la vista de ventas, para poder procesar ventas de sellos sin teclado físico.

#### Criterios de Aceptación

1. EN la vista KioskoView, los inputs de cantidad de TariffRow SE ACTIVARÁN con el teclado numérico
2. EN la vista KioskoView, los inputs de cantidad de DynamicTariffRow SE ACTIVARÁN con el teclado numérico
3. EL valor numérico introducido mediante el teclado virtual SE REFLEJARÁ en el store de Zustand (useKioskoStore) en tiempo real
4. LOS cálculos de subtotal y límite SE ACTUALIZARÁN en tiempo real mientras se escribe con el teclado virtual
5. EL teclado numérico NO INTERFERIRÁ con la interacción de las pestañas de la tabla de tarifas (tabs)
6. EL teclado numérico NO TAPARÁ el campo de cantidad que se está editando

### Requisito 7: Integración con Vistas de Configuración

**Historia de Usuario:** Como usuario, quiero que el teclado completo funcione en las vistas de configuración de máquina y eventos, para poder configurar la aplicación sin teclado físico.

#### Criterios de Aceptación

1. EN la vista MaquinaView, los campos de texto SE ACTIVARÁN con el teclado completo
2. EN el EventoEditor, los campos de texto (nombre, código, ubicación) SE ACTIVARÁN con el teclado completo
3. EN la vista SettingsView, los campos de texto SE ACTIVARÁN con el teclado completo
4. LAS transformaciones de texto existentes (toUpperCase, slice) SE APLICARÁN correctamente al texto introducido por el teclado virtual
5. EL teclado virtual RESPETARÁ los atributos maxLength de los inputs

### Requisito 8: Accesibilidad y Usabilidad Táctil

**Historia de Usuario:** Como operador usando una pantalla táctil, quiero que el teclado virtual sea fácil de usar y no interfiera con mi flujo de trabajo.

#### Criterios de Aceptación

1. EL teclado virtual PROPORCIONARÁ feedback visual al pulsar una tecla (efecto de presión/highlight)
2. EL teclado virtual SERÁ navegable mediante teclado físico si está disponible (no bloqueará la entrada física)
3. LAS teclas TENDRÁN suficiente separación entre ellas (mínimo 4px) para evitar pulsaciones accidentales
4. EL teclado INCLUIRÁ un botón visible para cerrarlo/ocultarlo manualmente
5. LA aparición y desaparición del teclado TENDRÁ una animación suave (200-300ms) para no ser abrupta
6. EL teclado virtual NO BLOQUEARÁ la entrada de teclado físico simultáneamente (ambos pueden coexistir)
7. TODOS los botones del teclado TENDRÁN atributos ARIA apropiados para lectores de pantalla

### Requisito 9: Cumplimiento del Stack Tecnológico

**Historia de Usuario:** Como desarrollador, quiero que el teclado virtual se implemente usando el stack tecnológico existente para mantener la consistencia del código.

#### Criterios de Aceptación

1. EL teclado virtual SE IMPLEMENTARÁ usando React functional components con TypeScript
2. EL estado del teclado virtual SE GESTIONARÁ con Zustand o React Context según corresponda
3. LOS estilos SE IMPLEMENTARÁN con Tailwind CSS utility classes
4. LAS animaciones USARÁN CSS transitions nativas
5. LA configuración SE PERSISTIRÁ usando el sistema IPC/SQLite existente
6. LA implementación NO INTRODUCIRÁ dependencias externas nuevas (se construirá custom)
7. EL teclado SOPORTARÁ internacionalización (i18n) para las etiquetas de teclas especiales (Espacio, Borrar, Mayúsculas)
