<template>
  <div class="p-4 bg-gray-100 min-h-screen">
    <!-- Top section: Modelo images + controls -->
    <div class="flex items-center justify-center pb-0 pt-0 bg-white rounded">
      <!-- Modelo 1 (left) -->
      <div class="flex flex-col items-center flex-1">
        <button
          class="bg-transparent border-none cursor-pointer p-1"
          aria-label="Pausar impresora"
          @click="pausarImpresora"
        >
          <span class="inline-flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded text-sm font-medium">
            <i class="fa fa-pause" aria-hidden="true"></i> Pausar impresora
          </span>
        </button>
        <button
          class="bg-transparent border-none cursor-pointer p-1"
          aria-label="Reanudar impresora"
          @click="reanudarImpresora"
        >
          <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-700 text-white rounded text-sm font-medium">
            <i class="fa fa-play" aria-hidden="true"></i> Reanudar impresora
          </span>
        </button>

        <div class="relative mt-2">
          <p class="text-center text-black text-sm font-bold"></p>
          <img
            :src="'/img/sellos/' + nombreModelo1 + '.jpg'"
            alt="Modelo 1"
            class="w-[300px] cursor-pointer"
            @click="imprimirProtocolo"
          >
          <p class="text-black text-sm font-bold text-center">
            {{ fechaInstalacion }}<br>{{ evento }}<br><br><br><br><br><br>
          </p>
          <p class="text-black text-xs font-bold text-center">
            &nbsp;&nbsp;&nbsp;{{ modocod }}{{ elmes }}{{ pais }}{{ elannio }} {{ nombre }}-{{ clientecod }}-001<br><br><br><br><br><br><br>
          </p>
        </div>
      </div>

      <!-- Center controls -->
      <div class="flex flex-1 items-center justify-center p-4">
        <div class="flex flex-col items-center gap-2">
          <img
            class="w-[80px] h-[65px] cursor-pointer"
            src="/img/filatelia.png"
            alt="Filatelia"
            @click="imprimirFilatelia"
          >
          <img
            class="w-[70px] h-[70px] cursor-pointer"
            src="/img/PNG/carrito-error.png"
            alt="Error impresión"
            @click="imprimirError"
          >
        </div>

        <div class="flex flex-col items-center gap-2 mx-4">
          <p class="text-center text-gray-500 text-sm font-bold">
            {{ (limite - total).toFixed(2) }} €
          </p>
          <h2 class="text-center text-xl font-bold">
            Cesta {{ total.toFixed(2) }}€
          </h2>
          <p class="text-center text-red-700 text-lg font-bold">
            {{ elmodo }}
          </p>
          <p class="text-center text-blue-600 text-xs font-bold">
            {{ ImprimeMasterTicket }}: MASTER SET
          </p>
          <p class="text-center text-red-700 text-[10px] font-bold">
            {{ ImprimeCopiaTicket }}: COPIA TICKET<br>
            {{ TEmod1 }}/{{ TEmod2 }} (€: {{ T1especial }}-{{ T2especial }}-{{ T3especial }})
          </p>
        </div>

        <div class="flex flex-col items-center gap-2">
          <button
            class="bg-transparent border-none cursor-pointer p-0"
            aria-label="Imprimir normal"
            @click="imprimirNormal"
          >
            <i class="fa fa-shopping-cart fa-4x text-[rgb(24,62,117)]" aria-hidden="true"></i>
          </button>
          <img
            class="w-[50px] h-[50px] cursor-pointer"
            src="/img/PNG/CANCELAR.png"
            alt="Cancelar"
            @click="reset"
          >
        </div>
      </div>

      <!-- Modelo 2 (right) -->
      <div class="flex flex-col items-center flex-1">
        <div class="relative">
          <img
            :src="'/img/sellos/' + nombreModelo2 + '.jpg'"
            alt="Modelo 2"
            class="w-[300px] cursor-pointer"
            @click="imprimirSPDE"
          >
          <p class="text-black text-sm font-bold text-center">
            {{ fechaInstalacion }}<br>{{ evento }}<br><br><br><br><br><br>
          </p>
          <p class="text-black text-xs font-bold text-center">
            &nbsp;&nbsp;&nbsp;{{ modocod }}{{ elmes }}{{ pais }}{{ elannio }} {{ nombre }}-{{ clientecod }}-001<br><br><br><br><br><br><br>
          </p>
        </div>
      </div>
    </div>

    <!-- Tariff table -->
    <div class="flex justify-center pt-0">
      <div class="w-full">
        <!-- Header -->
        <div class="flex items-center text-center text-sm font-semibold text-gray-600 py-2 border-b border-gray-300">
          <div class="w-[5%]">Subtotal</div>
          <div class="w-[10%]">Límite</div>
          <div class="w-[15%]">Cantidad</div>
          <div class="w-[30%]">Modalidad</div>
          <div class="w-[10%]">Precio</div>
          <div class="w-[15%]">Cantidad</div>
          <div class="w-[10%]">Límite</div>
          <div class="w-[5%]">Subtotal</div>
        </div>

        <!-- Tarifa A Tira 4 -->
        <div class="flex items-center text-center py-2 bg-gray-100">
          <div class="w-[5%] text-xs">{{ (tarifaAPrecioTira * tarifaAT1Cantidad).toFixed(2) }} €</div>
          <div class="w-[10%]">{{ limiteAT1 }}</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaAT1Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[30%] text-2xl font-semibold">Tarifa A Tira 4</div>
          <div class="w-[10%]">{{ tarifaAPrecioTira.toFixed(2) }}€</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaAT2Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[10%]">{{ limiteAT2 }}</div>
          <div class="w-[5%] text-xs">{{ (tarifaAPrecioTira * tarifaAT2Cantidad).toFixed(2) }} €</div>
        </div>

        <!-- Tira de 4 Tarifas -->
        <div class="flex items-center text-center py-2 bg-[rgb(24,62,117)] text-white">
          <div class="w-[5%] text-xs">{{ (tarifaPrecioTira4 * tarifa4T1Cantidad).toFixed(2) }} €</div>
          <div class="w-[10%]">{{ limite4T1 }}</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifa4T1Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-[rgb(24,62,117)] text-white text-3xl border border-gray-500 rounded"
            >
          </div>
          <div class="w-[30%] text-3xl font-semibold">Tira de 4 Tarifas</div>
          <div class="w-[10%]">{{ tarifaPrecioTira4 }}€</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifa4T2Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-[rgb(24,62,117)] text-white text-3xl border border-gray-500 rounded"
            >
          </div>
          <div class="w-[10%]">{{ limite4T2 }}</div>
          <div class="w-[5%] text-xs">{{ (tarifaPrecioTira4 * tarifa4T2Cantidad).toFixed(2) }} €</div>
        </div>

        <div class="border-b border-gray-300 my-2"></div>

        <!-- Tarifa A -->
        <div class="flex items-center text-center py-2 bg-[rgb(255,192,0)]">
          <div class="w-[5%] text-xs">{{ (tarifaAPrecioSimple * tarifaAS1Cantidad).toFixed(2) }} €</div>
          <div class="w-[10%]">{{ limiteAS1 }}</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaAS1Cantidad"
              type="number"
              min="0"
              class="w-16 text-center border border-gray-300 rounded"
            >
          </div>
          <div class="w-[30%] text-2xl font-semibold">Tarifa A</div>
          <div class="w-[10%]">{{ tarifaAPrecioSimple }}€</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaAS2Cantidad"
              type="number"
              min="0"
              class="w-16 text-center border border-gray-300 rounded"
            >
          </div>
          <div class="w-[10%]">{{ limiteAS2 }}</div>
          <div class="w-[5%] text-xs">{{ (tarifaAPrecioSimple * tarifaAS2Cantidad).toFixed(2) }} €</div>
        </div>

        <!-- Tarifa A2 -->
        <div class="flex items-center text-center py-2 bg-gray-100">
          <div class="w-[5%] text-xs">{{ (tarifaA2PrecioSimple * tarifaA2S1Cantidad).toFixed(2) }} €</div>
          <div class="w-[10%]">{{ limiteA2S1 }}</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaA2S1Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[30%] text-2xl font-semibold">Tarifa A2</div>
          <div class="w-[10%]">{{ tarifaA2PrecioSimple }}€</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaA2S2Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[10%]">{{ limiteA2S2 }}</div>
          <div class="w-[5%] text-xs">{{ (tarifaA2PrecioSimple * tarifaA2S2Cantidad).toFixed(2) }} €</div>
        </div>

        <!-- Tarifa B -->
        <div class="flex items-center text-center py-2 bg-gray-100">
          <div class="w-[5%] text-xs">{{ (tarifaBPrecioSimple * tarifaBS1Cantidad).toFixed(2) }} €</div>
          <div class="w-[10%]">{{ limiteBS1 }}</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaBS1Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[30%] text-2xl font-semibold">Tarifa B</div>
          <div class="w-[10%]">{{ tarifaBPrecioSimple }}€</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaBS2Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[10%]">{{ limiteBS2 }}</div>
          <div class="w-[5%] text-xs">{{ (tarifaBPrecioSimple * tarifaBS2Cantidad).toFixed(2) }} €</div>
        </div>

        <!-- Tarifa C -->
        <div class="flex items-center text-center py-2 bg-gray-100">
          <div class="w-[5%] text-xs">{{ (tarifaCPrecioSimple * tarifaCS1Cantidad).toFixed(2) }} €</div>
          <div class="w-[10%]">{{ limiteCS1 }}</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaCS1Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[30%] text-2xl font-semibold">Tarifa C</div>
          <div class="w-[10%]">{{ tarifaCPrecioSimple }}€</div>
          <div class="w-[15%]">
            <input
              v-model.number="tarifaCS2Cantidad"
              type="number"
              min="0"
              class="w-16 text-center bg-gray-200 border border-gray-300 rounded"
            >
          </div>
          <div class="w-[10%]">{{ limiteCS2 }}</div>
          <div class="w-[5%] text-xs">{{ (tarifaCPrecioSimple * tarifaCS2Cantidad).toFixed(2) }} €</div>
        </div>
      </div>
    </div>

    <!-- Footer: roll counters -->
    <div class="flex justify-center items-center pt-2">
      <div class="flex-1 text-center text-[rgb(24,62,117)] text-lg">
        {{ remainingRollo1 }}
        "{{ nombreModelo1 }}" (Venta: {{ rollo1ant }})
      </div>
      <div class="flex-1 text-center text-[rgb(24,62,117)]">
        Tickets: {{ remainingTickets }} (Utilizados: {{ ticketsventa }})
      </div>
      <div class="flex-1 text-center text-[rgb(24,62,117)] text-lg">
        {{ remainingRollo2 }}
        "{{ nombreModelo2 }}" (Venta: {{ rollo2ant }})
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Meteor } from 'meteor/meteor'
import { useConfig } from '../composables/useConfig'
import { useWebSocket } from '../composables/useWebSocket'
import { useOrders, type OrderLine } from '../composables/useOrders'

// --- Composables ---
const { config, updateSesion, updateSesionError, updateRollos, updateRollosRevert } = useConfig()
const { connect, send, isConnected } = useWebSocket()
const { insertOrder } = useOrders()

// --- Quantities state ---
const tarifaAS1Cantidad = ref(0)
const tarifaA2S1Cantidad = ref(0)
const tarifaBS1Cantidad = ref(0)
const tarifaCS1Cantidad = ref(0)
const tarifaAT1Cantidad = ref(0)
const tarifa4T1Cantidad = ref(0)
const tarifaAS2Cantidad = ref(0)
const tarifaA2S2Cantidad = ref(0)
const tarifaBS2Cantidad = ref(0)
const tarifaCS2Cantidad = ref(0)
const tarifaAT2Cantidad = ref(0)
const tarifa4T2Cantidad = ref(0)

// Track last sale for error reversal
const rollo1ant = ref(0)
const rollo2ant = ref(0)
const ticketsventa = ref(0)

// --- WebSocket connection ---
onMounted(() => {
  const wsHost = window.location.hostname || 'localhost'
  connect(`ws://${wsHost}:8000/`)
})

// --- Derived config values ---
const tarifaAPrecioSimple = computed(() => config.value?.precios?.tarifaA ?? 0)
const tarifaA2PrecioSimple = computed(() => config.value?.precios?.tarifaA2 ?? 0)
const tarifaBPrecioSimple = computed(() => config.value?.precios?.tarifaB ?? 0)
const tarifaCPrecioSimple = computed(() => config.value?.precios?.tarifaC ?? 0)
const tarifaAPrecioTira = computed(() => config.value?.precios?.tarifaTA ?? 0)
const tarifaPrecioTira4 = computed(() => config.value?.precios?.tarifaT4 ?? 0)

const rollo1 = computed(() => config.value?.ticket?.rollo1 ?? 0)
const rollo2 = computed(() => config.value?.ticket?.rollo2 ?? 0)
const tickets = computed(() => config.value?.ticket?.tickets ?? 0)
const TEmod1 = computed(() => config.value?.ticket?.TEmod1 ?? '')
const TEmod2 = computed(() => config.value?.ticket?.TEmod2 ?? '')
const T1especial = computed(() => config.value?.ticket?.T1especial ?? '')
const T2especial = computed(() => config.value?.ticket?.T2especial ?? '')
const T3especial = computed(() => config.value?.ticket?.T3especial ?? '')
const ImprimeCopiaTicket = computed(() => config.value?.ticket?.ImprimeCopiaTicket ?? '')
const ImprimeMasterTicket = computed(() => config.value?.ticket?.ImprimeMasterTicket ?? '')

const nombreModelo1 = computed(() => {
  if (!config.value) return ''
  const idx = config.value.sello.elevento ?? 0
  return config.value.sello[`motivoi${idx}`] ?? config.value.sello?.nombreModelo1 ?? ''
})
const nombreModelo2 = computed(() => {
  if (!config.value) return ''
  const idx = config.value.sello.elevento ?? 0
  return config.value.sello[`motivod${idx}`] ?? config.value.sello?.nombreModelo2 ?? ''
})

const nombre = computed(() => config.value?.codigo?.maquina ?? '')
const modocod = computed(() => config.value?.codigo?.modo ?? '')
const pais = computed(() => config.value?.codigo?.pais ?? '')

// Year calculation
const elannio = computed(() => {
  if (!config.value) return ''
  if (config.value.codigo.annio === 'auto') {
    return (new Date().getFullYear() - 2000).toString()
  }
  return config.value.codigo.annio
})

// Month calculation
const elmes = computed(() => {
  if (!config.value) return ''
  const mesCfg = config.value.codigo.mes
  if (mesCfg === 0) {
    const month = new Date().getMonth()
    if (month < 9) return (month + 1).toString()
    if (month === 9) return 'O'
    if (month === 10) return 'N'
    return 'D'
  }
  const m = Number(mesCfg)
  if (m === 10) return 'O'
  if (m === 11) return 'N'
  if (m === 12) return 'D'
  return mesCfg.toString()
})

// Client code formatting
const clientecod = computed(() => {
  if (!config.value) return ''
  const c = config.value.codigo.cliente
  if (c > 9999) return 'HACER RESET'
  if (c < 10) return '000' + c
  if (c < 100) return '00' + c
  if (c < 1000) return '0' + c
  return c.toString()
})

// Profile / mode
const elmodo = computed(() => {
  if (!config.value) return ''
  const perfil = config.value.sello.elperfil
  if (perfil && perfil >= 1 && perfil <= 5) {
    return config.value.sello[`nperfil${perfil}`] ?? ''
  }
  if (perfil === 6) return ''
  return ''
})

const limite = computed(() => {
  if (!config.value) return 0
  const perfil = config.value.sello.elperfil
  if (perfil === 6) return Number(config.value.ticket.limiteImporte) || 0
  const nuevoLimite = Number(config.value.ticket.NUEVOlimiteImporte)
  return nuevoLimite || Number(config.value.ticket.limiteImporte) || 0
})

// Event data based on elevento index
const fechaInstalacion = computed(() => {
  if (!config.value) return ''
  const idx = config.value.sello.elevento ?? 0
  return config.value.sello[`fecha${idx}`] ?? ''
})

const evento = computed(() => {
  if (!config.value) return ''
  const idx = config.value.sello.elevento ?? 0
  return config.value.sello[`localidad${idx}`] ?? ''
})

const elnevento = computed(() => config.value?.sello?.elnevento ?? '')

// --- Total calculation ---
const total = computed(() => {
  return (
    tarifaAPrecioSimple.value * (tarifaAS1Cantidad.value + tarifaAS2Cantidad.value) +
    tarifaA2PrecioSimple.value * (tarifaA2S1Cantidad.value + tarifaA2S2Cantidad.value) +
    tarifaBPrecioSimple.value * (tarifaBS1Cantidad.value + tarifaBS2Cantidad.value) +
    tarifaCPrecioSimple.value * (tarifaCS1Cantidad.value + tarifaCS2Cantidad.value) +
    tarifaAPrecioTira.value * (tarifaAT1Cantidad.value + tarifaAT2Cantidad.value) +
    tarifaPrecioTira4.value * (tarifa4T1Cantidad.value + tarifa4T2Cantidad.value)
  )
})

// --- Remaining stock calculations ---
const usedRollo1 = computed(() =>
  tarifaAT1Cantidad.value * 4 +
  tarifa4T1Cantidad.value * 4 +
  tarifaAS1Cantidad.value +
  tarifaA2S1Cantidad.value +
  tarifaBS1Cantidad.value +
  tarifaCS1Cantidad.value
)

const usedRollo2 = computed(() =>
  tarifaAT2Cantidad.value * 4 +
  tarifa4T2Cantidad.value * 4 +
  tarifaAS2Cantidad.value +
  tarifaA2S2Cantidad.value +
  tarifaBS2Cantidad.value +
  tarifaCS2Cantidad.value
)

const usedTickets = computed(() =>
  tarifaAT1Cantidad.value + tarifa4T1Cantidad.value +
  tarifaAT2Cantidad.value + tarifa4T2Cantidad.value
)

const remainingRollo1 = computed(() => rollo1.value - usedRollo1.value)
const remainingRollo2 = computed(() => rollo2.value - usedRollo2.value)
const remainingTickets = computed(() => tickets.value - 2 - usedTickets.value)

// --- Limit calculations for each tariff row ---
const limiteAT1 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaAPrecioTira.value || 1)),
  tickets.value - 2 - usedTickets.value,
  Math.floor((rollo1.value - usedRollo1.value) / 4)
))

const limiteAT2 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaAPrecioTira.value || 1)),
  tickets.value - 2 - usedTickets.value,
  Math.floor((rollo2.value - usedRollo2.value) / 4)
))

const limite4T1 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaPrecioTira4.value || 1)),
  tickets.value - 2 - usedTickets.value,
  Math.floor((rollo1.value - usedRollo1.value) / 4)
))

const limite4T2 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaPrecioTira4.value || 1)),
  tickets.value - 2 - usedTickets.value,
  Math.floor((rollo2.value - usedRollo2.value) / 4)
))

const limiteAS1 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaAPrecioSimple.value || 1)),
  rollo1.value - usedRollo1.value
))

const limiteAS2 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaAPrecioSimple.value || 1)),
  rollo2.value - usedRollo2.value
))

const limiteA2S1 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaA2PrecioSimple.value || 1)),
  rollo1.value - usedRollo1.value
))

const limiteA2S2 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaA2PrecioSimple.value || 1)),
  rollo2.value - usedRollo2.value
))

const limiteBS1 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaBPrecioSimple.value || 1)),
  rollo1.value - usedRollo1.value
))

const limiteBS2 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaBPrecioSimple.value || 1)),
  rollo2.value - usedRollo2.value
))

const limiteCS1 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaCPrecioSimple.value || 1)),
  rollo1.value - usedRollo1.value
))

const limiteCS2 = computed(() => Math.min(
  Math.floor((limite.value - total.value) / (tarifaCPrecioSimple.value || 1)),
  rollo2.value - usedRollo2.value
))

// --- Helper functions ---
function format2digits(n: number): string {
  return n < 10 ? '0' + n.toString() : n.toString()
}

function ensureNonNegative(): void {
  if (tarifaAS1Cantidad.value < 1) tarifaAS1Cantidad.value = 0
  if (tarifaA2S1Cantidad.value < 1) tarifaA2S1Cantidad.value = 0
  if (tarifaBS1Cantidad.value < 1) tarifaBS1Cantidad.value = 0
  if (tarifaCS1Cantidad.value < 1) tarifaCS1Cantidad.value = 0
  if (tarifaAT1Cantidad.value < 1) tarifaAT1Cantidad.value = 0
  if (tarifa4T1Cantidad.value < 1) tarifa4T1Cantidad.value = 0
  if (tarifaAS2Cantidad.value < 1) tarifaAS2Cantidad.value = 0
  if (tarifaA2S2Cantidad.value < 1) tarifaA2S2Cantidad.value = 0
  if (tarifaBS2Cantidad.value < 1) tarifaBS2Cantidad.value = 0
  if (tarifaCS2Cantidad.value < 1) tarifaCS2Cantidad.value = 0
  if (tarifaAT2Cantidad.value < 1) tarifaAT2Cantidad.value = 0
  if (tarifa4T2Cantidad.value < 1) tarifa4T2Cantidad.value = 0
}

function reset(): void {
  tarifaAS1Cantidad.value = 0
  tarifaA2S1Cantidad.value = 0
  tarifaBS1Cantidad.value = 0
  tarifaCS1Cantidad.value = 0
  tarifaAT1Cantidad.value = 0
  tarifa4T1Cantidad.value = 0
  tarifaAS2Cantidad.value = 0
  tarifaA2S2Cantidad.value = 0
  tarifaBS2Cantidad.value = 0
  tarifaCS2Cantidad.value = 0
  tarifaAT2Cantidad.value = 0
  tarifa4T2Cantidad.value = 0
}

/**
 * Build the 31-field WebSocket message using the `*¿?*` separator protocol.
 */
function buildMessage(perfilpros: string): string {
  if (!config.value) return ''

  // Compute fecha_ticket
  let fecha_ticket: string
  let fechaMaquina: string
  if (config.value.ticket.fecha === 'auto') {
    const fecha = new Date()
    fecha_ticket = format2digits(fecha.getDate()) + '/' + format2digits(fecha.getMonth() + 1) + '/' + fecha.getFullYear() + ' ' + format2digits(fecha.getHours()) + ':' + format2digits(fecha.getMinutes()) + ':' + format2digits(fecha.getSeconds())
    fechaMaquina = format2digits(fecha.getDate()) + '/' + format2digits(fecha.getMonth() + 1) + '/' + fecha.getFullYear()
  } else {
    const fecha = new Date()
    fecha_ticket = config.value.ticket.fecha
    fechaMaquina = format2digits(fecha.getDate()) + '/' + format2digits(fecha.getMonth() + 1) + '/' + fecha.getFullYear()
  }

  // Compute mes_maquina for message
  let mes_maquina: string
  const mesCfg = config.value.codigo.mes
  if (mesCfg === 0) {
    const month = new Date().getMonth()
    if (month < 9) {
      mes_maquina = (month + 1).toString()
    } else if (month === 9) {
      mes_maquina = 'O'
    } else if (month === 10) {
      mes_maquina = 'N'
    } else {
      mes_maquina = 'D'
    }
  } else {
    const m = Number(mesCfg)
    if (m === 10) mes_maquina = 'O'
    else if (m === 11) mes_maquina = 'N'
    else if (m === 12) mes_maquina = 'D'
    else mes_maquina = mesCfg.toString()
  }

  // Compute year_maquina
  let year_maquina: string
  if (config.value.codigo.annio === 'auto') {
    year_maquina = new Date().getFullYear().toString()
  } else {
    year_maquina = config.value.codigo.annio
  }

  // Titulo based on profile type
  let eltitulo = config.value.ticket.titulo
  let eltituloCopia = config.value.ticket.tituloCopia
  if (perfilpros === 'filatelia') {
    eltitulo = 'Filatelia de: ' + config.value.ticket.titulo
    eltituloCopia = 'COPIA Filatelia de: ' + config.value.ticket.titulo
  }
  if (perfilpros === 'protocolo') {
    eltitulo = 'Protocolo de: ' + config.value.ticket.titulo
    eltituloCopia = 'COPIA Protocolo de: ' + config.value.ticket.titulo
  }
  if (perfilpros === 'spde') {
    eltitulo = 'SPDE de: ' + config.value.ticket.titulo
    eltituloCopia = 'COPIA SPDE de: ' + config.value.ticket.titulo
  }

  // Items and prices strings
  const items = [
    tarifaAS1Cantidad.value, tarifaA2S1Cantidad.value, tarifaBS1Cantidad.value, tarifaCS1Cantidad.value,
    tarifaAT1Cantidad.value, tarifa4T1Cantidad.value,
    tarifaAS2Cantidad.value, tarifaA2S2Cantidad.value, tarifaBS2Cantidad.value, tarifaCS2Cantidad.value,
    tarifaAT2Cantidad.value, tarifa4T2Cantidad.value
  ].join(' ')

  const precios = [
    tarifaAPrecioSimple.value, tarifaA2PrecioSimple.value,
    tarifaBPrecioSimple.value, tarifaCPrecioSimple.value
  ].join(' ')

  const SEP = '*¿?*'
  const idx = config.value.sello.elevento ?? 0
  const msgFecha = config.value.sello[`fecha${idx}`] ?? config.value.sello.fecha ?? ''
  const msgEvento = config.value.sello[`localidad${idx}`] ?? config.value.sello.evento ?? ''
  const msgModelo1 = config.value.sello[`motivoi${idx}`] ?? config.value.sello.modelo1 ?? ''
  const msgModelo2 = config.value.sello[`motivod${idx}`] ?? config.value.sello.modelo2 ?? ''

  const message =
    config.value.codigo.cliente + SEP +
    config.value.codigo.producto + SEP +
    msgFecha + SEP +
    msgEvento + SEP +
    fecha_ticket + SEP +
    eltitulo + SEP +
    msgModelo1 + SEP +
    msgModelo2 + SEP +
    config.value.codigo.modo + SEP +
    config.value.codigo.maquina + SEP +
    mes_maquina + SEP +
    config.value.codigo.pais + SEP +
    year_maquina + SEP +
    items + SEP +
    precios + SEP +
    config.value.ticket.empresa + SEP +
    config.value.ticket.cif + SEP +
    config.value.ticket.cp + SEP +
    config.value.ticket.l1 + SEP +
    config.value.ticket.l2 + SEP +
    config.value.ticket.l3 + SEP +
    (config.value.sello[`nferia${idx}`] ?? config.value.sello.feria ?? '') + SEP +
    (config.value.sello[`nlugar${idx}`] ?? config.value.sello.lugar ?? '') + SEP +
    (config.value.ticket.T1especial ?? '') + SEP +
    (config.value.ticket.T2especial ?? '') + SEP +
    (config.value.ticket.T3especial ?? '') + SEP +
    (config.value.ticket.TEmod1 ?? '') + SEP +
    (config.value.ticket.TEmod2 ?? '') + SEP +
    (config.value.ticket.ImprimeCopiaTicket ?? '') + SEP +
    (config.value.ticket.ImprimeMasterTicket ?? '') + SEP +
    eltituloCopia

  return message
}

/**
 * Build order records for the database based on current quantities.
 */
function buildOrderRecords(perfilpros: string, fecha_ticket: string, fechaMaquina: string, mes_maquina: string, year_maquina: string, eltitulo: string): OrderLine[] {
  if (!config.value) return []

  const items = [
    tarifaAS1Cantidad.value, tarifaA2S1Cantidad.value, tarifaBS1Cantidad.value, tarifaCS1Cantidad.value,
    tarifaAT1Cantidad.value, tarifa4T1Cantidad.value,
    tarifaAS2Cantidad.value, tarifaA2S2Cantidad.value, tarifaBS2Cantidad.value, tarifaCS2Cantidad.value,
    tarifaAT2Cantidad.value, tarifa4T2Cantidad.value
  ]

  // Compute mesMaquina for order record
  let mesMaquina: number | string
  const mesCfg = config.value.codigo.mes
  if (mesCfg === 0) {
    const month = new Date().getMonth()
    mesMaquina = month < 9 ? (month + 1) : (month === 9 ? 10 : month === 10 ? 11 : 12)
  } else {
    mesMaquina = Number(mesCfg)
  }

  // Determine modoImpresion based on perfilpros
  let modoImpresion = config.value.sello.elnperfil ?? ''
  if (perfilpros === 'filatelia') modoImpresion = 'Filatelia de ' + (config.value.sello.elnperfil ?? '')
  if (perfilpros === 'protocolo') modoImpresion = 'Protocolo de ' + (config.value.sello.elnperfil ?? '')
  if (perfilpros === 'spde') modoImpresion = 'SPDE de ' + (config.value.sello.elnperfil ?? '')

  const newOrderArray: OrderLine[] = []

  for (let i = 0; i < items.length; i++) {
    if (items[i] > 0) {
      let type: string
      let qtySet: number
      let precio: number

      if (i === 4 || i === 10) {
        type = 'Tarifa A Tira 4'
        qtySet = 4
        precio = tarifaAPrecioTira.value
      } else if (i === 5 || i === 11) {
        type = 'Tira de 4 Tarifas'
        qtySet = 4
        precio = tarifaPrecioTira4.value
      } else {
        type = 'Etiqueta individual'
        qtySet = 1
        if (i === 0 || i === 6) precio = tarifaAPrecioSimple.value
        else if (i === 1 || i === 7) precio = tarifaA2PrecioSimple.value
        else if (i === 2 || i === 8) precio = tarifaBPrecioSimple.value
        else precio = tarifaCPrecioSimple.value
      }

      const modelo = i <= 5 ? config.value.sello.modelo1 : config.value.sello.modelo2

      newOrderArray.push({
        event: config.value.sello.fecha,
        venue: config.value.sello.evento,
        machine: config.value.codigo.maquina,
        vendType: type,
        productName: modelo,
        transactionDate: fecha_ticket,
        quantity: items[i],
        quantitySet: qtySet,
        totalStamps: items[i] * qtySet,
        currency: 'EUR',
        value: precio,
        paymentStatus: modoImpresion,
        sesionId: config.value.codigo.cliente,
        etiquetasRollo1: config.value.ticket.rollo1,
        etiquetasRollo2: config.value.ticket.rollo2,
        etiquetaMes: mes_maquina,
        titutoEvento: config.value.sello.elnevento ?? '',
        feria: config.value.sello.feria ?? '',
        Lugar: config.value.sello.lugar ?? '',
        fecha: fechaMaquina,
        mes: mesMaquina,
        annio: year_maquina,
        documento: eltitulo,
      })
    }
  }

  return newOrderArray
}

// --- Print actions ---
function pausarImpresora(): void {
  Meteor.call('pausarImpresora', (error: Error | null) => {
    if (error) alert('Error al pausar impresora: ' + error.message)
    else alert('Impresora pausada correctamente')
  })
}

function reanudarImpresora(): void {
  Meteor.call('reanudarImpresora', (error: Error | null) => {
    if (error) alert('Error al reanudar impresora: ' + error.message)
    else alert('Impresora reanudada correctamente')
  })
}

function imprimirFilatelia(): void {
  imprimir('filatelia')
}

function imprimirNormal(): void {
  imprimir('normal')
}

function imprimirProtocolo(): void {
  imprimir('protocolo')
}

function imprimirSPDE(): void {
  imprimir('spde')
}

async function imprimir(perfilpros: string): Promise<void> {
  if (!config.value) return

  ensureNonNegative()

  const sellos1 = tarifaAS1Cantidad.value + tarifaA2S1Cantidad.value + tarifaBS1Cantidad.value + tarifaCS1Cantidad.value + 4 * tarifaAT1Cantidad.value + 4 * tarifa4T1Cantidad.value
  const sellos2 = tarifaAS2Cantidad.value + tarifaA2S2Cantidad.value + tarifaBS2Cantidad.value + tarifaCS2Cantidad.value + 4 * tarifaAT2Cantidad.value + 4 * tarifa4T2Cantidad.value

  // Validations
  if (sellos1 > rollo1.value && sellos2 > rollo2.value) {
    alert('No hay suficientes sellos del primer motivo ni del segundo')
    return
  }
  if (sellos1 > rollo1.value) {
    alert('No hay suficientes sellos del primer motivo')
    return
  }
  if (sellos2 > rollo2.value) {
    alert('No hay suficientes sellos del segundo motivo')
    return
  }
  if (total.value > limite.value) {
    alert('Ha excedido el límite de compra de ' + limite.value + '€')
    return
  }
  if ((2 + tarifaAT1Cantidad.value + tarifa4T1Cantidad.value + tarifaAT2Cantidad.value + tarifa4T2Cantidad.value) > tickets.value) {
    alert('No hay suficientes tickets')
    return
  }
  if (total.value === 0) {
    return
  }
  if (clientecod.value === 'HACER RESET') {
    alert('Límite de ID Cliente, haga reset en menú MÁQUINA')
    return
  }

  // Store values for potential error reversal
  rollo1ant.value = sellos1
  rollo2ant.value = sellos2
  ticketsventa.value = 2 + tarifaAT1Cantidad.value + tarifa4T1Cantidad.value + tarifaAT2Cantidad.value + tarifa4T2Cantidad.value

  // Determine ticket deduction mode
  let modotickets: number
  if (elmodo.value === 'Abono/Envío' || elmodo.value === 'Esporádicos') {
    modotickets = 0
  } else {
    modotickets = 2 + tarifaAT1Cantidad.value + tarifa4T1Cantidad.value + tarifaAT2Cantidad.value + tarifa4T2Cantidad.value
  }

  try {
    await updateSesion()
    await updateRollos(sellos1, sellos2, modotickets)

    // Compute values needed for order records
    let fecha_ticket: string
    let fechaMaquina: string
    if (config.value.ticket.fecha === 'auto') {
      const fecha = new Date()
      fecha_ticket = format2digits(fecha.getDate()) + '/' + format2digits(fecha.getMonth() + 1) + '/' + fecha.getFullYear() + ' ' + format2digits(fecha.getHours()) + ':' + format2digits(fecha.getMinutes()) + ':' + format2digits(fecha.getSeconds())
      fechaMaquina = format2digits(fecha.getDate()) + '/' + format2digits(fecha.getMonth() + 1) + '/' + fecha.getFullYear()
    } else {
      const fecha = new Date()
      fecha_ticket = config.value.ticket.fecha
      fechaMaquina = format2digits(fecha.getDate()) + '/' + format2digits(fecha.getMonth() + 1) + '/' + fecha.getFullYear()
    }

    let mes_maquina: string
    const mesCfg2 = config.value.codigo.mes
    if (mesCfg2 === 0) {
      const month = new Date().getMonth()
      if (month < 9) mes_maquina = (month + 1).toString()
      else if (month === 9) mes_maquina = 'O'
      else if (month === 10) mes_maquina = 'N'
      else mes_maquina = 'D'
    } else {
      const m = Number(mesCfg2)
      if (m === 10) mes_maquina = 'O'
      else if (m === 11) mes_maquina = 'N'
      else if (m === 12) mes_maquina = 'D'
      else mes_maquina = mesCfg2.toString()
    }

    let year_maquina: string
    if (config.value.codigo.annio === 'auto') {
      year_maquina = new Date().getFullYear().toString()
    } else {
      year_maquina = config.value.codigo.annio
    }

    let eltitulo = config.value.ticket.titulo
    if (perfilpros === 'filatelia') eltitulo = 'Filatelia de: ' + config.value.ticket.titulo
    if (perfilpros === 'protocolo') eltitulo = 'Protocolo de: ' + config.value.ticket.titulo
    if (perfilpros === 'spde') eltitulo = 'SPDE de: ' + config.value.ticket.titulo

    const orderRecords = buildOrderRecords(perfilpros, fecha_ticket, fechaMaquina, mes_maquina, year_maquina, eltitulo)
    if (orderRecords.length > 0) {
      await insertOrder(orderRecords)
    }

    // Build and send WebSocket message
    const message = buildMessage(perfilpros)
    send(message)
    reset()
  } catch (err) {
    console.error('[KioskoView] Error during print:', err)
    alert('Error al procesar la impresión')
  }
}

/**
 * Handle print error: revert session ID and roll counts, insert error record.
 */
async function imprimirError(): Promise<void> {
  if (!config.value) return

  const confirmed = confirm('¿Error de IMPRESIÓN? ¡Se procederá a ANULAR la VENTA ANTERIOR!')
  if (!confirmed) {
    alert('¡Operación cancelada!')
    return
  }

  if (rollo1ant.value <= 0 && rollo2ant.value <= 0) {
    alert('¡¡NINGUNA venta encontrada!!')
    return
  }

  try {
    await updateSesionError()
    await updateRollosRevert(rollo1ant.value, rollo2ant.value, ticketsventa.value)

    const errorOrder: OrderLine[] = [{
      event: 'ELIMINAR ANTERIOR',
      venue: ' ',
      machine: 'error de impresión',
      vendType: ' ',
      productName: ' ',
      transactionDate: '',
      quantity: 0,
      quantitySet: 0,
      totalStamps: 0,
      currency: ' ',
      value: 0,
      paymentStatus: 'Error',
      sesionId: config.value.codigo.cliente,
      etiquetasRollo1: 0,
      etiquetasRollo2: 0,
      etiquetaMes: ' ',
      titutoEvento: 'Error',
      feria: config.value.sello.feria ?? '',
      Lugar: config.value.sello.lugar ?? '',
      fecha: 'Error',
      mes: 'Error',
      annio: 'Error',
      documento: 'Error',
    }]

    await insertOrder(errorOrder)

    rollo1ant.value = 0
    rollo2ant.value = 0
    ticketsventa.value = 0
    reset()
  } catch (err) {
    console.error('[KioskoView] Error reverting print:', err)
    alert('Error al anular la venta')
  }
}
</script>
