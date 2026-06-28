<template>
  <div class="flex flex-col items-center justify-center min-h-screen px-4 py-8 gap-8">
    <!-- Section headers -->
    <div class="flex w-full max-w-3xl justify-between items-center">
      <h2 class="text-xl font-normal text-[#212F5D] text-center flex-1">
        CONFIGURACIÓN
      </h2>
      <div class="text-center flex-1">
        <p class="text-red-600 text-lg font-bold">
          i7 Mojave<br>ESPERAR 10" QUE CARGUE EL SISTEMA
        </p>
      </div>
      <h2 class="text-xl font-normal text-[#212F5D] text-center flex-1">
        MÁQUINA
      </h2>
    </div>

    <!-- Navigation icons row -->
    <div class="flex w-full max-w-3xl justify-center items-center gap-4">
      <!-- Imprimir (Configuración) icon -->
      <button
        class="flex-[2] flex justify-center items-center cursor-pointer bg-transparent border-none p-0"
        aria-label="imprimir"
        @click="goTo('imprimir')"
      >
        <img
          src="/img/jckiosco-V5.svg"
          alt="Configuración de impresión"
          class="w-full h-auto max-h-48"
        >
      </button>

      <!-- App version tooltip -->
      <div class="flex-none relative group">
        <span class="text-gray-500 cursor-help text-sm">app</span>
        <div
          class="invisible group-hover:visible absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-pre-line"
        >
          ---------------------------------- <br>
          MEJORAS<br>
          ---------------------------------- <br>
          (FIaa) NO imprime en ETIQUETA ni FECHA ni LUGAR<br>
          TICKET por cada TIRA: NO imprime con nombre máquina= CHaa / FIaa<br>
          TICKETS TIRAS: Siempre longitud pequeña TicketsTiras.PDF<br>
          N. TICKETS: NO resta con Perfiles= ESPORÁDICOS y ABONO<br>
          LÍMITE IMPORTE: Perfil FERIA<br>
          NUEVO LÍMITE IMPORTE: Resto de PERFILES<br>
          LONGITUD TICKETS: El CORTE se ajusta según conceptos<br>
          ENTRADAS: Precio por TIRAS (errores en 4.199999)<br>
          BASES DE DATOS: Perfiles - Eventos<br>
          BLOQUEO DE EVENTO: Hasta quitar rollos<br>
          ANULACIÓN VENTA: casos de error de impresión<br>
          KIOSCO ACCESOS DIRECTOS: Cesta - Filatelia - Protocolo<br>
          SIMULACIONES: Texto y Códigos actuales en ETIQUETAS<br>
          MENSAJES de AYUDA ../..<br>
          -------------------------------------------<br>
          JC 2022 (Meteor/Vue 3/Python)<br>
          ------------------------------------------
        </div>
      </div>

      <!-- Spacer -->
      <div class="flex-none w-4"></div>

      <!-- Export XLS icon -->
      <button
        class="flex-1 flex justify-center items-center cursor-pointer bg-transparent border-none p-0"
        aria-label="Exportar informe"
        @click="exportarXLS"
      >
        <img
          src="/img/jckiosco-V4.svg"
          alt="Exportar informe XLS"
          class="w-full h-auto max-h-32"
        >
      </button>

      <!-- Info tooltip -->
      <div class="flex-none relative group">
        <span class="text-gray-500 cursor-help text-sm">i</span>
        <div
          class="invisible group-hover:visible absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-pre-line"
        >
          ---------------------------------- <br>
          INFORME de MAC a PC<br>
          ---------------------------------- <br>
          1-Copiar y Pegar en SUBLIME<br>
          2-Guardar como CSV<br>
          3-Abrir NUMBERS<br>
          4-Abrir fichero CSV<br>
          5-EXPORTAR para EXCEL...<br>
          6-EXTENSIÓN XLSX<br>
          ---------------------------------- <br>
          Los acentos y formatos de columnas se mantienen<br>
          ----------------------------------
        </div>
      </div>

      <!-- Maquina icon -->
      <button
        class="flex-[2] flex justify-center items-center cursor-pointer bg-transparent border-none p-0"
        aria-label="maquina"
        @click="goTo('maquina')"
      >
        <img
          src="/img/jckiosco.svg"
          alt="Configuración de máquina"
          class="w-full h-auto max-h-48"
        >
      </button>
    </div>

    <!-- Description labels row -->
    <div class="flex w-full max-w-3xl justify-between items-start">
      <p class="text-gray-500 text-sm font-bold text-center flex-1">
        PERFIL<br>EVENTO<br>TARIFAS
      </p>
      <p class="text-gray-500 text-sm font-bold text-center flex-1">
        RESET ID<br>(inicio del año)
      </p>
      <p class="text-gray-500 text-sm font-bold text-center flex-1">
        CÓDIGO ETIQUETA<br>TICKET<br>ROLLOS
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWebSocket } from '../composables/useWebSocket'
import { useOrders } from '../composables/useOrders'

const router = useRouter()
const { connect, isConnected } = useWebSocket()
const { downloadXLS } = useOrders()

// Establish WebSocket connection on mount (mirrors original AngularJS behavior)
onMounted(() => {
  connect('ws://169.254.145.162:8000/')
})

function goTo(dest: string): void {
  router.push(`/${dest}`)
}

async function exportarXLS(): Promise<void> {
  try {
    const fileContent = await downloadXLS()
    if (fileContent) {
      const nameFile = 'reporte-ATM.csv'
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nameFile
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.error('[HomeView] Error exporting XLS:', err)
  }
}
</script>
