# Guía: Subir Imágenes desde old-version a la App

## Resumen

Las imágenes de fondo de sellos del sistema legacy (carpeta `old-version/demonio/images/`) se pueden cargar en la nueva aplicación a través de la vista **Subir Imagen**. La app las almacena como Data URI (Base64) en la base de datos SQLite y las muestra como fondo en la previsualización del Kiosko.

## Requisitos previos

1. La app debe estar corriendo en modo desarrollo: `npm run dev`
2. Tener configurado al menos un evento con nombres de motivo (`motivoi` / `motivod`) en la sección **Imprimir > Eventos**

## Paso a paso

### 1. Arrancar la app

```bash
npm run dev
```

### 2. Configurar los nombres de motivo del evento activo

Antes de subir una imagen, asegúrate de que los nombres de motivo en el evento activo coinciden con los nombres que quieres usar. Ve a:

**Imprimir → Evento → Editar datos del evento activo**

Por ejemplo, si quieres usar la imagen `Castillo.png` como Modelo 1, el campo `motivoi` del evento activo debe ser `Castillo`.

> El nombre del motivo es el identificador con el que se guarda la imagen en la base de datos. La imagen se asocia al modelo por este nombre.

### 3. Ir a la vista Subir Imagen

Navega a **Subir Imagen** desde el menú o desde la vista Máquina (botón "Volver" te lleva a Máquina, desde ahí puedes navegar).

Ruta directa: `/subir-imagen`

### 4. Seleccionar el modelo

En la vista verás dos secciones:

- **Modelo 1** (impresora izquierda) — muestra el nombre del motivo del evento activo
- **Modelo 2** (impresora derecha) — muestra el nombre del motivo del evento activo

Pulsa **"Subir Imagen"** en el modelo al que quieras asignar la imagen.

### 5. Seleccionar el archivo

Tienes dos opciones:

- **Click** en la zona de drop para abrir el selector de archivos
- **Arrastrar** el archivo PNG/JPG directamente desde el explorador de archivos

Navega hasta la carpeta del proyecto:

```
old-version/demonio/images/
```

Y selecciona la imagen deseada. Por ejemplo:
- `Castillo.png`
- `fondoetiqueta1.png`
- `Mortadelo y Filemón.png`
- `La Vuelta 25.png`

### 6. Recortar la imagen

La app mostrará un editor de recorte con proporción fija **11:5** (que corresponde a los 55x25mm de la etiqueta). 

- Usa el **slider de zoom** para ajustar
- Arrastra la imagen para encuadrar la parte deseada
- Pulsa **"Guardar Imagen"**

### 7. Verificar en el Kiosko

Navega a la vista **Kiosko** (`/kiosko`). En la parte superior verás la previsualización de los modelos con la imagen que acabas de subir como fondo.

Si no ves la imagen:
- Verifica que el nombre del motivo en el evento activo coincide exactamente con el nombre con el que se guardó
- La previsualización se carga automáticamente según `config.sello.eventos[elevento].motivoi` y `.motivod`

## Imágenes disponibles en old-version

Algunas imágenes útiles de la carpeta `old-version/demonio/images/`:

| Archivo | Uso típico |
|---------|-----------|
| `fondoetiqueta-nada.png` | Fondo vacío (fallback por defecto) |
| `fondoetiqueta1.png` | Fondo estándar modelo 1 |
| `fondoetiqueta2.png` | Fondo estándar modelo 2 |
| `Castillo.png` | Motivo Castillo |
| `Mortadelo y Filemón.png` | Motivo Mortadelo y Filemón |
| `La Vuelta 25.png` | Motivo La Vuelta ciclista 2025 |
| `Año Serpiente.png` | Motivo Año Serpiente |
| `DH 60 Moth.png` | Motivo aviación DH 60 Moth |
| `Homenaje ATM.png` | Motivo homenaje ATM |
| `TiraEspecial1.png` - `TiraEspecial4.png` | Fondos para tiras especiales |
| `fondoticketori.png` | Fondo ticket original |
| `fondoticketcop.png` | Fondo ticket copia |
| `image2.jpg` | Logo Correos para tickets |

## Flujo técnico

```
Usuario selecciona archivo PNG/JPG
    ↓
ImageUpload.tsx lee el archivo como DataURL (FileReader)
    ↓
react-easy-crop recorta a proporción 11:5
    ↓
Canvas genera Data URI (image/png) del recorte
    ↓
IPC: uploadImage(nombre, dataUri, type, size)
    ↓
Main process → images.repository.ts → INSERT en tabla `images`
    ↓
Kiosko → StampModels.tsx → getImageByName(motivoi/motivod)
    ↓
Muestra la imagen como <img src={dataUri}> en la previsualización
```

## Eliminar una imagen

En la vista **Subir Imagen**, si ya hay una imagen cargada para un modelo:
1. Aparece un botón **"Eliminar"** junto al botón de cambiar
2. Se pide confirmación antes de borrar
3. La imagen se elimina de la base de datos
4. En el Kiosko se mostrará el placeholder con el nombre del motivo

## Notas importantes

- Las imágenes se guardan como **Base64 en la base de datos SQLite**, no como archivos sueltos
- El nombre con el que se guarda es el del motivo (`motivoi`/`motivod`) del evento activo en el momento de la subida
- Si cambias el nombre del motivo en un evento, necesitarás re-subir la imagen con el nuevo nombre
- El recorte siempre produce un PNG, independientemente del formato original
- No hay límite de tamaño estricto, pero imágenes muy grandes aumentarán el tamaño de la BD
