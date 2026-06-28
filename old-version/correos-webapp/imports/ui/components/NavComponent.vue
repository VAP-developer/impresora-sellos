<template>
  <div class="w-full h-px bg-black"></div>
  <nav class="h-[100px] bg-[rgb(255,192,0)] flex items-center px-4">
    <!-- Left logo - Home -->
    <router-link to="/home" class="flex-shrink-0">
      <img
        src="/img/izquierda.png"
        alt="Correos - Inicio"
        class="w-[250px] mt-4"
      />
    </router-link>

    <div class="flex-1"></div>

    <!-- Imprimir link -->
    <router-link to="/imprimir" class="flex-shrink-0">
      <img
        src="/img/jckiosco-V5.svg"
        alt="Imprimir"
        class="w-[50px] mt-4"
      />
    </router-link>

    <div class="flex-1"></div>

    <!-- Info popup -->
    <div class="relative inline-block cursor-pointer select-none" @click="togglePopup">
      <img
        src="/img/info.svg"
        alt="Información del kiosko"
        class="w-8 h-8"
      />
      <div
        v-show="showPopup"
        class="absolute z-10 w-[650px] bg-gray-600 text-white text-center rounded-md py-2 px-4 left-1/2 -translate-x-1/2 top-full mt-2 text-sm leading-relaxed animate-fadeIn"
      >
        <p class="font-bold mb-1">Logotipo FILATELIA a PERFIL FILATELIA</p>
        <p class="mb-2">
          • Pruebas al colocar los rollos<br />
          • Cambios por etiquetas defectuosas<br />
          (para DESTRUCCIÓN)
        </p>
        <hr class="border-gray-400 my-1" />
        <p class="mb-2">
          MOTIVO 1 a PERFIL PROTOCOLO<br /><br />
          MOTIVO 2 a PERFIL SPDE
        </p>
        <hr class="border-gray-400 my-1" />
        <p class="font-bold mb-1">CARRO ANULACIÓN VENTA</p>
        <p class="mb-2">para cuando las IMPRESORAS NO FUNCIONAN</p>
        <p class="text-left pl-4">
          Pasos a seguir antes de pulsarlo:<br />
          1º Apagar/Encender Impresoras<br />
          2º Abrir los spool de impresión y reiniciar impresión si hubiera pendientes<br />
          3º PULSAR BOTÓN de ANULACIÓN CESTA ANTERIOR<br />
          (se restablecerán las cantidades de etiquetas, tickets e ID)<br />
          4º Cerrar y Abrir la Aplicación<br />
          5º APAGAR, esperar y Reiniciar el Equipo
        </p>
        <hr class="border-gray-400 my-1" />
        <p class="font-bold text-red-300">
          IMPORTANTE en los campos CANTIDAD:<br />
          NUNCA DEJAR NINGUNO EN BLANCO<br />
          <span class="font-normal text-white">
            (HACE VENTA pero no imprime, pulsar CARRO ANULACIÓN y reiniciar la aplicación)
          </span>
        </p>
      </div>
    </div>

    <div class="flex-1"></div>

    <!-- Maquina link -->
    <router-link to="/maquina" class="flex-shrink-0">
      <img
        src="/img/jckiosco.svg"
        alt="Máquina"
        class="w-[50px] mt-4"
      />
    </router-link>

    <div class="flex-1"></div>
    <div class="flex-1"></div>

    <!-- Right logo - Kiosko -->
    <router-link to="/kiosko" class="flex-shrink-0">
      <img
        src="/img/derecha.png"
        alt="Kiosko"
        class="w-[250px] mt-4"
      />
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const showPopup = ref(false)

function togglePopup() {
  showPopup.value = !showPopup.value
}

function closePopupOnOutsideClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (showPopup.value && !target.closest('.relative')) {
    showPopup.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closePopupOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closePopupOnOutsideClick)
})
</script>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
