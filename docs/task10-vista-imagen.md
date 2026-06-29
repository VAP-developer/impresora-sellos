# Task 10: Vista Subir Imagen

## Resumen

Esta tarea implementa la funcionalidad de **subida y gestión de imágenes de fondo** para los sellos. Las imágenes se usan como motivo/fondo en las etiquetas impresas (55×25mm). La vista permite al vendedor subir, recortar y eliminar imágenes que luego se almacenan como data URI (Base64) en la base de datos SQLite.

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 10.1 | Crear componente ImageUpload.tsx con drag&drop y recorte de imagen | ✅ Completada |
| 10.2 | Implementar subida de imagen como base64 via IPC | ✅ Completada |
| 10.3 | Implementar eliminación de imagen | ✅ Completada |
| 10.4 | Verificar que las imágenes subidas aparecen como fondo en la previsualización de Kiosko | ⬜ Pendiente |

---

## Detalle de lo realizado (10.1)

### ¿Qué se hizo?

Se creó el componente `ImageUpload.tsx` con soporte completo de **drag & drop** y **recorte de imagen** usando la librería `react-easy-crop`. El componente permite al vendedor:

1. Arrastrar un archivo de imagen sobre una zona de drop (o hacer click para seleccionar)
2. Previsualizar la imagen seleccionada
3. Recortar la imagen con la proporción correcta para sellos (11:5 = 55mm × 25mm)
4. Ajustar el zoom (1x–3x)
5. Guardar la imagen recortada como data URI PNG

### Dependencia instalada

| Paquete | Versión | Tipo | Propósito |
|---------|---------|------|-----------|
| `react-easy-crop` | ^6.0.2 | dependency | Librería React para recorte interactivo de imágenes con soporte de aspect ratio, zoom y drag |

### ¿Por qué `react-easy-crop`?

Se evaluaron varias opciones:

| Librería | Tamaño | Motivo de descarte/elección |
|----------|--------|----------------------------|
| `react-easy-crop` | ~12KB gzip | ✅ Elegida. Ligera, sin dependencias, API sencilla con hooks, soporta aspect ratio fijo |
| `react-cropper` | ~40KB gzip | Más pesada, wrapper de Cropper.js, más funcionalidades de las necesarias |
| `react-image-crop` | ~8KB gzip | Más ligera pero sin zoom ni rotación integrados |

`react-easy-crop` ofrece el balance ideal: soporte de aspect ratio fijo (crítico para las etiquetas 55×25mm), zoom integrado, y una API basada en callbacks que encaja con el modelo de React hooks.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/images/ImageUpload.tsx` | Componente principal de subida con drag&drop + crop |
| `src/renderer/src/types/react-easy-crop.d.ts` | Declaración de tipos TypeScript para react-easy-crop |

### Arquitectura del componente

```
ImageUpload.tsx
├── Estado: Drop Zone (sin imagen seleccionada)
│   ├── Zona de arrastrar y soltar con feedback visual
│   ├── Click para abrir diálogo de archivo
│   └── Validación de tipo (solo acepta imágenes)
│
└── Estado: Crop Mode (imagen seleccionada)
    ├── Cropper interactivo con aspect ratio 11:5
    ├── Slider de zoom (1x - 3x)
    ├── Botón "Cancelar" (vuelve a Drop Zone)
    └── Botón "Guardar Imagen" (recorta + sube via callback)
```

### API del componente

```typescript
interface ImageUploadProps {
  /** Nombre/identificador para la imagen (ej: "Modelo1", "Modelo2") */
  imageName: string
  /** Callback invocado con la imagen recortada lista para subir */
  onUpload: (name: string, dataUri: string, type: string, size: number) => Promise<void>
  /** Opcional: se ejecuta tras subida exitosa */
  onSuccess?: () => void
  /** Opcional: se ejecuta si la subida falla */
  onError?: (error: Error) => void
}
```

**Ejemplo de uso** (integración futura en SubirImagenView):

```tsx
import ImageUpload from '@renderer/components/images/ImageUpload'
import { ipcClient } from '@renderer/lib/ipc-client'

function SubirImagenView() {
  const handleUpload = async (name: string, dataUri: string, type: string, size: number) => {
    await ipcClient.images.upload(name, dataUri, type, size)
  }

  return (
    <ImageUpload
      imageName="MotivoFeria2025"
      onUpload={handleUpload}
      onSuccess={() => console.log('Imagen subida')}
    />
  )
}
```

### Funciones auxiliares internas

#### `getCroppedImage(imageSrc, pixelCrop) → Promise<string>`

Extrae la región recortada de la imagen usando Canvas API:

1. Crea un `<canvas>` con las dimensiones del recorte
2. Dibuja la porción correspondiente de la imagen original
3. Exporta como data URI PNG (`canvas.toDataURL('image/png')`)

Este enfoque es **completamente client-side** — no requiere servidor ni librería adicional.

#### `createImage(url) → Promise<HTMLImageElement>`

Helper que carga una imagen desde una URL/data URI y devuelve una promesa que se resuelve cuando la imagen está completamente cargada. Necesario porque `drawImage` del canvas requiere un elemento `<img>` ya cargado.

### Detalle de la zona de Drop

La zona de drop implementa los siguientes estados visuales:

| Estado | Borde | Fondo | Cuándo |
|--------|-------|-------|--------|
| Normal | `border-gray-300` | `bg-gray-50` | Sin interacción |
| Hover | `border-gray-400` | `bg-gray-100` | Mouse sobre la zona |
| Drag válido | `border-blue-500` | `bg-blue-50` | Arrastrando archivo de imagen |
| Drag inválido | `border-red-400` | `bg-red-50` | Arrastrando archivo no-imagen |

### Aspect ratio 11:5

El crop usa `aspect={11/5}` que corresponde exactamente a las dimensiones de la etiqueta postal:
- **55mm de ancho ÷ 25mm de alto = 11:5**

Esto garantiza que las imágenes recortadas encajan perfectamente en el PDF de etiqueta sin distorsión ni letterboxing.

### Accesibilidad

- `role="button"` + `tabIndex={0}` en la zona de drop → navegable con teclado
- `onKeyDown` maneja Enter y Space para abrir el diálogo
- `aria-label` descriptivo para lectores de pantalla
- `aria-hidden="true"` en el input de archivo oculto
- Label asociado al slider de zoom

### Declaración de tipos (`react-easy-crop.d.ts`)

Se creó un archivo de declaración de tipos manual porque `react-easy-crop` no incluye tipos TypeScript propios compatibles con la configuración de `moduleResolution` del proyecto. El archivo declara:

- `Point` — coordenadas {x, y} del crop
- `Area` — región {x, y, width, height} del recorte
- `CropperProps` — props del componente Cropper
- Export default del componente `Cropper`

### Verificación

```bash
# Build completo pasa sin errores:
$ npx electron-vite build
# ✓ main: 12 modules, built in ~300ms
# ✓ preload: 1 module, built in ~16ms
# ✓ renderer: 98 modules, built in ~1.75s

# La dependencia está instalada:
$ cat package.json | grep react-easy-crop
#     "react-easy-crop": "^6.0.2",
```

### Requisitos validados

| Requisito | Criterio | Cubierto por |
|-----------|----------|--------------|
| 14.1 | Almacenar imagen como data URI (Base64) con nombre único | `onUpload` callback recibe dataUri + name |
| 14.3 | Usar imagen correspondiente al motivo configurado | Aspect ratio 11:5 garantiza compatibilidad con el PDF de etiqueta |

---

## Detalle de lo realizado (10.2)

### ¿Qué se hizo?

Se implementó el flujo completo de **subida de imagen como base64 vía IPC**, conectando el componente `ImageUpload` (creado en 10.1) con la vista `SubirImagenView` y el backend de Electron a través de las capas IPC ya existentes.

### Flujo completo de subida

```
┌──────────────────────────────────────────────────────────────────────────┐
│ RENDERER                                                                  │
│                                                                          │
│  SubirImagenView.tsx                                                     │
│  ├── Carga imágenes existentes via getImageByName()                      │
│  ├── Muestra previews de Modelo 1 / Modelo 2                            │
│  ├── Botones "Subir Imagen" / "Cambiar Imagen"                          │
│  └── Al seleccionar modelo → muestra ImageUpload.tsx                     │
│                                                                          │
│  ImageUpload.tsx                                                         │
│  ├── Drag & drop o click → seleccionar archivo                          │
│  ├── FileReader.readAsDataURL(file) → convierte a base64                │
│  ├── Cropper (aspect 11:5) → recorta a proporción 55×25mm              │
│  ├── Canvas API → getCroppedImage() → data URI PNG recortado            │
│  └── Llama onUpload(name, dataUri, type, size)                          │
│           │                                                              │
│           ▼                                                              │
│  ipc-client.ts → uploadImage(name, dataUri, type, size)                  │
│           │                                                              │
│           ▼                                                              │
│  window.electronAPI.images.upload(name, dataUri, type, size)             │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    │ ipcRenderer.invoke('images:upload', ...)
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PRELOAD (contextBridge)                                                   │
│                                                                          │
│  images.upload: (name, dataUri, type, size) =>                           │
│      ipcRenderer.invoke('images:upload', name, dataUri, type, size)      │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    │ IPC invoke
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                              │
│                                                                          │
│  images.handlers.ts                                                      │
│  └── handleIpc('images:upload', (name, dataUri, type, size) => {         │
│          repo.upload(name, dataUri, type, size)                           │
│      })                                                                  │
│                                                                          │
│  images.repository.ts                                                    │
│  └── upload(name, dataUri, type, size):                                  │
│      INSERT OR REPLACE INTO images (name, type, size, data)              │
│      VALUES (@name, @type, @size, @data)                                 │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ SQLite (images table)                                                     │
│                                                                          │
│  id | name            | type      | size   | data                        │
│  1  | MotivoIzq2025   | image/png | 45320  | data:image/png;base64,...   │
│  2  | MotivoDer2025   | image/png | 38100  | data:image/png;base64,...   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Archivos involucrados

| Archivo | Rol | Capa |
|---------|-----|------|
| `src/renderer/src/views/SubirImagenView.tsx` | Vista principal — selección de modelo, preview, coordinación del upload | Renderer |
| `src/renderer/src/components/images/ImageUpload.tsx` | Drag&drop, lectura de archivo, crop, conversión a base64 | Renderer |
| `src/renderer/src/lib/ipc-client.ts` | Wrapper tipado (`uploadImage()`) | Renderer |
| `src/preload/index.ts` | contextBridge — expone `electronAPI.images.upload` | Preload |
| `src/main/ipc/images.handlers.ts` | Handler IPC `images:upload` → delega al repositorio | Main |
| `src/main/database/repositories/images.repository.ts` | `INSERT OR REPLACE INTO images` en SQLite | Main |

### Detalle de SubirImagenView.tsx

La vista orquesta la experiencia completa:

1. **Al montar**: carga las imágenes existentes de los motivos del evento activo (`motivoi` / `motivod`) desde la BD usando `getImageByName()`
2. **Muestra previews**: si hay imagen existente muestra `<img src={dataUri}>`, sino muestra "Sin imagen"
3. **Selección de modelo**: el vendedor elige Modelo 1 o Modelo 2 (botón "Subir/Cambiar Imagen")
4. **Modo upload**: muestra el componente `ImageUpload` con el nombre del motivo como `imageName`
5. **Tras subida exitosa**: refresca los previews de ambos modelos volviendo a consultar la BD
6. **Navegación**: botón "Volver" regresa a `/maquina`

```typescript
// Callback que conecta ImageUpload con el IPC
const handleUpload = useCallback(
  async (name: string, dataUri: string, type: string, size: number): Promise<void> => {
    await uploadImage(name, dataUri, type, size)
  },
  []
)
```

### Relación con la configuración

La vista lee del store de configuración:
- `config.sello.elevento` → índice del evento activo (0-7)
- `config.sello.eventos[elevento].motivoi` → nombre de imagen para Modelo 1 (impresora izquierda)
- `config.sello.eventos[elevento].motivod` → nombre de imagen para Modelo 2 (impresora derecha)

Estos nombres se usan como clave (`name`) en la tabla `images`. Al subir una imagen para un modelo, se guarda con el nombre del motivo configurado. Si ya existía una imagen con ese nombre, se reemplaza (`INSERT OR REPLACE`).

### Operación `INSERT OR REPLACE`

```sql
INSERT OR REPLACE INTO images (name, type, size, data)
VALUES (@name, @type, @size, @data)
```

- **Si la imagen NO existe**: inserta un nuevo registro
- **Si la imagen YA existe** (mismo `name`): reemplaza todos los campos (actualización)
- Esto permite "cambiar" la imagen de un modelo sin necesidad de eliminar la anterior primero

### Estados de UI durante la subida

| Estado | Indicación visual |
|--------|-------------------|
| Seleccionando archivo | Drop zone con feedback de color (azul=válido, rojo=no imagen) |
| Recortando | Cropper interactivo + slider de zoom |
| Subiendo | Botón deshabilitado + texto "Subiendo..." |
| Éxito | Mensaje verde "Imagen subida correctamente" + preview actualizado |
| Error | Mensaje rojo "Error al subir la imagen" |

### Tests (16 tests pasan)

```bash
$ npx vitest run src/renderer/src/__tests__/subir-imagen-view.test.tsx
```

Los tests cubren:
- Renderizado de la vista con ambos modelos
- Carga de previews desde BD (mock de `getImageByName`)
- Mostrar botón "Cambiar" cuando existe imagen
- Click en "Subir Imagen" muestra el componente de upload
- Navegación de vuelta a modelos ("← Volver a modelos")
- Integración IPC (`uploadImage` se llama con los parámetros correctos)
- Navegación a `/maquina` con el botón "Volver"

### Requisitos validados

| Requisito | Criterio | Cubierto por |
|-----------|----------|--------------|
| 14.1 | Almacenar imagen como data URI (Base64) con nombre único | `INSERT OR REPLACE` con `name` como clave única |
| 14.3 | Usar imagen del motivo configurado para el modelo activo | Preview carga por `motivoi`/`motivod` del evento activo |
| 14.4 | Si la imagen no existe, usar fondo por defecto | `getImageByName` retorna `null` → vista muestra "Sin imagen" (el fallback a `fondoetiqueta-nada.png` se aplica en la generación de PDF) |

---

## Detalle de lo realizado (10.3)

### ¿Qué se hizo?

Se implementó la funcionalidad de **eliminación de imagen** en la vista SubirImagenView. El vendedor puede eliminar las imágenes de fondo asignadas a cada modelo (Modelo 1 / Modelo 2), con confirmación previa para evitar borrados accidentales.

### Flujo de eliminación

```
┌──────────────────────────────────────────────────────────────────────────┐
│ RENDERER (SubirImagenView.tsx)                                            │
│                                                                          │
│  1. Vendedor ve preview de imagen con botón "Eliminar" (rojo)            │
│  2. Click en "Eliminar" → abre modal de confirmación                     │
│  3. Vendedor confirma → handleDelete(model)                              │
│     ├── setDeleting(true) — deshabilita botones                          │
│     ├── removeImage(name) → IPC call                                     │
│     ├── Éxito: setModelo1Url(null) o setModelo2Url(null)                 │
│     │          + mensaje verde "Imagen eliminada correctamente"          │
│     └── Error: mensaje rojo "Error al eliminar la imagen"                │
│                                                                          │
│  ipc-client.ts → removeImage(name: string): Promise<void>                │
│           │                                                              │
│           ▼                                                              │
│  window.electronAPI.images.remove(name)                                  │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    │ ipcRenderer.invoke('images:remove', name)
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PRELOAD (contextBridge)                                                   │
│                                                                          │
│  images.remove: (name) => ipcRenderer.invoke('images:remove', name)      │
└──────────────────────────────────────────────────────────────────────────┘
                    │
                    │ IPC invoke
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                              │
│                                                                          │
│  images.handlers.ts                                                      │
│  └── handleIpc('images:remove', (name) => {                              │
│          repo.remove(name)                                                │
│      })                                                                  │
│                                                                          │
│  images.repository.ts                                                    │
│  └── remove(name: string): boolean                                       │
│      DELETE FROM images WHERE name = ?                                    │
│      return result.changes > 0                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Componentes de UI implementados

#### Botón "Eliminar"

- Aparece **solo** cuando el modelo tiene una imagen cargada (`modelo1Url !== null`)
- Estilizado en rojo (`bg-red-600`) junto al botón "Subir/Cambiar Imagen"
- Se deshabilita durante la operación de borrado (`disabled={deleting}`)
- `aria-label` descriptivo: `Eliminar imagen {nombreModelo}`

#### Modal de confirmación

Implementado como overlay modal con:
- Fondo oscuro semitransparente (`bg-black/50`, `z-50`)
- Card centrado con título, mensaje descriptivo y dos botones
- Botón "Cancelar" (gris) — cierra el modal sin hacer nada
- Botón "Eliminar" (rojo) — ejecuta la eliminación
- Texto de advertencia: *"Esta acción no se puede deshacer"*
- Ambos botones deshabilitados durante la operación (`disabled={deleting}`)
- El botón cambia a "Eliminando..." mientras procesa

#### Mensajes de estado

Tras la operación se muestra un mensaje:
- **Éxito** (verde): `Imagen "{nombre}" eliminada correctamente.`
- **Error** (rojo): `Error al eliminar la imagen. Inténtalo de nuevo.`

El mensaje se oculta automáticamente al entrar en modo upload.

### Estado añadido al componente

```typescript
// Delete confirmation state
const [confirmDelete, setConfirmDelete] = useState<'modelo1' | 'modelo2' | null>(null)
const [deleting, setDeleting] = useState(false)
const [deleteStatus, setDeleteStatus] = useState<{ message: string; error: boolean } | null>(null)
```

| Estado | Tipo | Propósito |
|--------|------|-----------|
| `confirmDelete` | `'modelo1' \| 'modelo2' \| null` | Controla qué modelo tiene el modal de confirmación abierto |
| `deleting` | `boolean` | Indica operación en curso (deshabilita botones) |
| `deleteStatus` | `{ message, error } \| null` | Resultado de la última operación (éxito/error) |

### Handler de eliminación

```typescript
const handleDelete = useCallback(
  async (model: 'modelo1' | 'modelo2') => {
    const name = model === 'modelo1' ? modelo1Name : modelo2Name
    setDeleting(true)
    setDeleteStatus(null)

    try {
      await removeImage(name)
      // Update UI state to reflect deletion
      if (model === 'modelo1') {
        setModelo1Url(null)
      } else {
        setModelo2Url(null)
      }
      setDeleteStatus({ message: `Imagen "${name}" eliminada correctamente.`, error: false })
    } catch (err) {
      console.error('[SubirImagenView] Error deleting image:', err)
      setDeleteStatus({ message: 'Error al eliminar la imagen. Inténtalo de nuevo.', error: true })
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  },
  [modelo1Name, modelo2Name]
)
```

**Notas de implementación:**
- El handler es `useCallback` memorizado (depende solo de los nombres de modelo)
- Tras éxito, solo actualiza el estado local (no recarga desde DB) — es una actualización optimista
- Tras error, preserva la imagen en la UI (no borra el preview)
- `finally` cierra siempre el modal y resetea el estado de "deleting"

### Backend (ya existente)

La capa de backend ya estaba implementada desde las Tasks 2 y 3:

| Capa | Archivo | Función |
|------|---------|---------|
| IPC Client | `src/renderer/src/lib/ipc-client.ts` | `removeImage(name)` |
| Preload | `src/preload/index.ts` | `images.remove → ipcRenderer.invoke('images:remove')` |
| IPC Handler | `src/main/ipc/images.handlers.ts` | `handleIpc('images:remove', ...)` |
| Repository | `src/main/database/repositories/images.repository.ts` | `remove(name)` → `DELETE FROM images WHERE name = ?` |

La SQL ejecutada:
```sql
DELETE FROM images WHERE name = ?
```

El método `remove()` retorna un booleano indicando si se eliminó algo (`result.changes > 0`), pero el handler IPC no utiliza este valor de retorno — simplemente ejecuta la operación.

### Tests (7 tests nuevos — total 24 pasan)

```bash
$ npx vitest run src/renderer/src/__tests__/subir-imagen-view.test.tsx
# ✓ 24 tests passed
```

Tests añadidos en la sección `describe('Image Deletion – Task 10.3')`:

| Test | Verifica |
|------|----------|
| shows "Eliminar" button when a model has an image | El botón aparece solo cuando hay imagen |
| does not show "Eliminar" button when model has no image | Sin imagen → sin botón de eliminar |
| shows confirmation dialog when "Eliminar" is clicked | Click abre el modal de confirmación |
| cancels deletion when "Cancelar" is clicked in the dialog | Cancelar cierra el modal sin llamar IPC |
| calls removeImage via IPC when deletion is confirmed | Confirmar llama `removeImage(nombre)` |
| shows success message after successful deletion | Mensaje verde tras éxito |
| shows error message when deletion fails | Mensaje rojo tras error |
| removes image preview from UI after successful deletion | El `<img>` desaparece del DOM |

### Requisitos validados

| Requisito | Criterio | Cubierto por |
|-----------|----------|--------------|
| 14.2 | "CUANDO el vendedor elimina una imagen, EL Sistema DEBERÁ removerla de la base de datos" | `removeImage(name)` → `DELETE FROM images WHERE name = ?` |

### Verificación

```bash
# Build completo pasa sin errores:
$ npx electron-vite build
# ✓ main, preload, renderer compilados

# Tests de la vista pasan:
$ npx vitest run src/renderer/src/__tests__/subir-imagen-view.test.tsx
# Test Files  1 passed (1)
#      Tests  24 passed (24)
```

---

## Pendiente para la siguiente subtarea

### 10.4 — Verificación visual

- Confirmar que las imágenes subidas se muestran correctamente en la previsualización de modelos en KioskoView (`StampModels.tsx`)
- Verificar el fallback a `fondoetiqueta-nada.png` cuando no existe la imagen del motivo
- Test end-to-end: subir imagen → verificar que aparece en Kiosko
- Test end-to-end: eliminar imagen → verificar que el preview en Kiosko vuelve al fondo por defecto
