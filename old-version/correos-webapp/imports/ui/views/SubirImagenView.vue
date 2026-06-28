<template>
  <div class="p-4 bg-gray-100 min-h-screen">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2">
      <p class="text-black text-[25px] font-bold text-center">SUBIR IMAGEN</p>
      <router-link
        to="/maquina"
        class="bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500 no-underline"
      >
        Volver
      </router-link>
    </div>

    <div class="flex justify-center mt-4">
      <div class="w-full max-w-4xl px-4">
        <!-- Model selection -->
        <div class="flex gap-8 justify-center mb-6">
          <!-- Modelo 1 -->
          <div class="flex flex-col items-center">
            <h3 class="text-base font-bold mb-2">Modelo 1</h3>
            <div
              v-if="modelo1"
              class="border-2 border-gray-300 rounded p-2 mb-2"
            >
              <img
                :src="modelo1"
                alt="Modelo 1"
                class="max-w-[200px] max-h-[200px] object-contain"
              >
            </div>
            <p v-else class="text-gray-400 text-sm mb-2">Sin imagen</p>
            <button
              class="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
              @click="selectModel('Modelo1')"
            >
              {{ modelo1 ? 'Cambiar' : 'Subir' }} Imagen
            </button>
          </div>

          <!-- Modelo 2 -->
          <div class="flex flex-col items-center">
            <h3 class="text-base font-bold mb-2">Modelo 2</h3>
            <div
              v-if="modelo2"
              class="border-2 border-gray-300 rounded p-2 mb-2"
            >
              <img
                :src="modelo2"
                alt="Modelo 2"
                class="max-w-[200px] max-h-[200px] object-contain"
              >
            </div>
            <p v-else class="text-gray-400 text-sm mb-2">Sin imagen</p>
            <button
              class="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
              @click="selectModel('Modelo2')"
            >
              {{ modelo2 ? 'Cambiar' : 'Subir' }} Imagen
            </button>
          </div>
        </div>

        <!-- Drop zone / file selector -->
        <div
          class="bg-gray-50 border-[5px] border-dashed border-gray-300 rounded text-center p-8 cursor-pointer transition-colors"
          :class="{
            'border-blue-500 bg-blue-50': isDragOver,
            'border-red-400': isDragReject,
          }"
          @click="triggerFileInput"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileSelected"
          >
          <div class="text-gray-600">
            <p class="text-lg">Haz click para seleccionar el archivo</p>
            <p class="my-2"><strong>o si lo prefieres</strong></p>
            <p class="text-lg">También puedes arrastrar el archivo aquí</p>
          </div>
        </div>

        <!-- Status message -->
        <div v-if="statusMessage" class="mt-4 text-center">
          <p
            :class="statusError ? 'text-red-600' : 'text-green-600'"
            class="font-semibold"
          >
            {{ statusMessage }}
          </p>
        </div>

        <!-- Uploading indicator -->
        <div v-if="uploading" class="mt-4 text-center">
          <p class="text-blue-600 font-semibold">Subiendo imagen...</p>
        </div>
      </div>
    </div>

    <!-- Crop dialog -->
    <ImageCropDialog
      :visible="showCropDialog"
      :image-src="cropImageSrc"
      @save="onCropSave"
      @cancel="onCropCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useImages } from '../composables/useImages'
import ImageCropDialog from '../components/ImageCropDialog.vue'

const { modelo1, modelo2, uploadImage } = useImages()

// State
const selectedModelName = ref<string>('')
const cropImageSrc = ref<string>('')
const showCropDialog = ref(false)
const isDragOver = ref(false)
const isDragReject = ref(false)
const uploading = ref(false)
const statusMessage = ref('')
const statusError = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

/**
 * Sets which model (Modelo1 or Modelo2) will be updated, then opens the file picker.
 */
function selectModel(name: string): void {
  selectedModelName.value = name
  triggerFileInput()
}

/**
 * Programmatically triggers the hidden file input.
 */
function triggerFileInput(): void {
  if (!selectedModelName.value) {
    selectedModelName.value = 'Modelo1'
  }
  fileInputRef.value?.click()
}

/**
 * Handles file selection from the file input element.
 */
function onFileSelected(event: Event): void {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
  // Reset so the same file can be selected again
  if (target) target.value = ''
}

/**
 * Drag-over handler for visual feedback.
 */
function onDragOver(event: DragEvent): void {
  isDragOver.value = true
  isDragReject.value = false

  // Check if files contain images
  if (event.dataTransfer?.items) {
    const item = event.dataTransfer.items[0]
    if (item && item.type && !item.type.startsWith('image/')) {
      isDragReject.value = true
    }
  }
}

/**
 * Drag-leave handler to reset visual state.
 */
function onDragLeave(): void {
  isDragOver.value = false
  isDragReject.value = false
}

/**
 * Drop handler: reads the dropped file.
 */
function onDrop(event: DragEvent): void {
  isDragOver.value = false
  isDragReject.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (!file.type.startsWith('image/')) {
      statusMessage.value = 'El archivo seleccionado no es una imagen válida.'
      statusError.value = true
      return
    }
    if (!selectedModelName.value) {
      selectedModelName.value = 'Modelo1'
    }
    processFile(file)
  }
}

/**
 * Reads a File as a data URI and opens the crop dialog.
 */
function processFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    statusMessage.value = 'El archivo seleccionado no es una imagen válida.'
    statusError.value = true
    return
  }

  statusMessage.value = ''
  statusError.value = false

  const reader = new FileReader()
  reader.onload = (e: ProgressEvent<FileReader>) => {
    const result = e.target?.result
    if (typeof result === 'string') {
      cropImageSrc.value = result
      showCropDialog.value = true
    }
  }
  reader.readAsDataURL(file)
}

/**
 * Called when the user confirms the crop. Uploads the cropped image.
 */
async function onCropSave(dataUri: string): Promise<void> {
  showCropDialog.value = false
  uploading.value = true
  statusMessage.value = ''
  statusError.value = false

  try {
    await uploadImage(dataUri, selectedModelName.value)
    statusMessage.value = `Imagen "${selectedModelName.value}" subida correctamente.`
    statusError.value = false
  } catch (err) {
    console.error('Error uploading image:', err)
    statusMessage.value = 'Error al subir la imagen. Inténtalo de nuevo.'
    statusError.value = true
  } finally {
    uploading.value = false
    cropImageSrc.value = ''
  }
}

/**
 * Called when the user cancels the crop dialog.
 */
function onCropCancel(): void {
  showCropDialog.value = false
  cropImageSrc.value = ''
}
</script>
