<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    @click.self="cancel"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
      <h3 class="text-lg font-bold mb-4">Editar &amp; recortar</h3>

      <!-- Crop area -->
      <div class="w-full h-[300px] bg-gray-100 rounded overflow-hidden mb-4">
        <cropper
          ref="cropperRef"
          class="w-full h-full"
          :src="imageSrc"
          :stencil-props="{ aspectRatio: 1 }"
          image-restriction="stencil"
        />
      </div>

      <!-- Action buttons -->
      <div class="flex justify-end gap-3">
        <button
          class="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
          @click="cancel"
        >
          Cancelar
        </button>
        <button
          class="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
          @click="save"
        >
          Guardar Imagen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

interface Props {
  visible: boolean
  imageSrc: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', dataUri: string): void
  (e: 'cancel'): void
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

function save(): void {
  if (!cropperRef.value) return

  const { canvas } = cropperRef.value.getResult()
  if (canvas) {
    const dataUri = canvas.toDataURL('image/png')
    emit('save', dataUri)
  }
}

function cancel(): void {
  emit('cancel')
}
</script>
