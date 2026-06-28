<template>
  <div class="p-4 min-h-screen">
    <!-- Header -->
    <div class="flex flex-col items-center gap-2 mb-4">
      <p class="text-black text-2xl font-bold text-center">CONFIGURACIÓN</p>
      <button
        class="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
        @click="guardar"
      >
        GUARDAR e ir al MENÚ MÁQUINA Y GUARDAR
      </button>
      <p class="text-gray-500 text-2xl font-bold text-center">PERFIL - EVENTOS - TARIFAS</p>
    </div>

    <!-- PERFIL - MODO DE VENTA -->
    <section class="mb-6">
      <div class="bg-amber-400 p-2 mb-2 rounded shadow">
        <h3 class="text-black font-bold m-0">PERFIL - MODO DE VENTA</h3>
      </div>
      <div class="flex flex-col items-center">
        <label class="text-red-600 text-lg font-bold mb-1">Ir a Menú MÁQUINA y GUARDAR</label>
        <select
          v-model="elperfil"
          class="w-[250px] text-blue-700 text-lg border border-gray-300 rounded p-2"
        >
          <option :value="1">{{ nperfil1 }}</option>
          <option :value="2">{{ nperfil2 }}</option>
          <option :value="3">{{ nperfil3 }}</option>
          <option :value="4">{{ nperfil4 }}</option>
          <option :value="5">{{ nperfil5 }}</option>
          <option :value="6">{{ nperfil6 }}</option>
        </select>
      </div>
    </section>

    <!-- EVENTO -->
    <section class="mb-6">
      <div class="bg-amber-400 p-2 mb-2 rounded shadow">
        <h3 class="text-black font-bold m-0">EVENTO: {{ bloqueado === 'BLOQUEADO' ? 'BLOQUEADO' : 'DESBLOQUEADO' }}</h3>
      </div>

      <div class="flex flex-col items-center gap-4 p-4">
        <!-- Event selector -->
        <div v-if="bloqueado !== 'BLOQUEADO'">
          <label class="block text-red-600 font-bold mb-1">EVENTO</label>
          <select
            v-model="elevento"
            class="w-[250px] text-red-600 text-lg border border-gray-300 rounded p-2"
          >
            <option v-for="i in 8" :key="i - 1" :value="i - 1">
              {{ eventos[i - 1]?.nevento || ('Evento ' + i) }}
            </option>
          </select>
          <button
            class="ml-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            @click="guardar"
          >
            ACTIVAR
          </button>
        </div>
        <div v-else>
          <label class="block text-red-600 font-bold mb-1">EVENTO</label>
          <select
            :value="elevento"
            disabled
            class="w-[250px] text-red-600 text-lg border border-gray-300 rounded p-2 opacity-60"
          >
            <option v-for="i in 8" :key="i - 1" :value="i - 1">
              {{ eventos[i - 1]?.nevento || ('Evento ' + i) }}
            </option>
          </select>
        </div>

        <!-- Current event info -->
        <p class="text-black text-2xl font-bold text-center">
          {{ currentFeria }}<br>{{ currentLugar }}
        </p>

        <!-- Stamp images -->
        <div class="flex flex-row gap-8">
          <div class="flex flex-col items-center">
            <p class="text-black text-xl font-bold text-center">{{ nombreModelo1 }}</p>
            <div class="relative">
              <img
                :src="'/img/sellos/' + nombreModelo1 + '.jpg'"
                :alt="nombreModelo1"
                class="w-[350px]"
              >
              <p class="absolute bottom-[10%] left-0 text-black text-lg font-bold p-4">
                &nbsp;&nbsp;&nbsp;{{ fechaInstalacion }}<br>{{ eventoLocalidad }}
              </p>
            </div>
          </div>
          <div class="flex flex-col items-center">
            <p class="text-black text-xl font-bold text-center">{{ nombreModelo2 }}</p>
            <div class="relative">
              <img
                :src="'/img/sellos/' + nombreModelo2 + '.jpg'"
                :alt="nombreModelo2"
                class="w-[350px]"
              >
              <p class="absolute bottom-[10%] left-0 text-black text-lg font-bold p-4">
                &nbsp;&nbsp;&nbsp;{{ fechaInstalacion }}<br>{{ eventoLocalidad }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- EDITAR EVENTOS -->
    <section class="mb-6">
      <div class="bg-amber-400 p-2 mb-2 rounded shadow">
        <h3 class="text-black font-bold m-0">EDITAR EVENTOS</h3>
      </div>

      <!-- Radio buttons to select event to edit -->
      <div class="flex flex-wrap gap-2 items-center mb-4 p-2">
        <span class="font-bold">SELECCIONE:</span>
        <label class="inline-flex items-center gap-1">
          <input v-model="editingEvent" type="radio" :value="-1">
          <span class="text-sm">Ninguno</span>
        </label>
        <label v-for="i in 8" :key="i - 1" class="inline-flex items-center gap-1">
          <input v-model="editingEvent" type="radio" :value="i - 1">
          <span class="text-sm">{{ eventos[i - 1]?.nevento || ('Evento ' + i) }}</span>
        </label>
      </div>

      <!-- Event editing form -->
      <div v-if="editingEvent >= 0 && editingEvent <= 7" class="flex flex-col items-center gap-4 p-4">
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Evento {{ editingEvent + 1 }}</label>
          <input
            v-model="eventos[editingEvent].nevento"
            class="w-full text-red-600 text-2xl font-bold text-center border border-gray-300 rounded p-2"
          >
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Feria Ticket</label>
          <input v-model="eventos[editingEvent].nferia" class="w-full border border-gray-300 rounded p-2">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Lugar Ticket</label>
          <input v-model="eventos[editingEvent].nlugar" class="w-full border border-gray-300 rounded p-2">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Fechas Etiqueta</label>
          <input v-model="eventos[editingEvent].fecha" class="w-full border border-gray-300 rounded p-2">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Localidad Etiqueta</label>
          <input v-model="eventos[editingEvent].localidad" class="w-full border border-gray-300 rounded p-2">
        </div>
        <div class="flex gap-4">
          <div class="w-[300px]">
            <label class="block text-sm text-gray-600">Motivo izquierda</label>
            <input v-model="eventos[editingEvent].motivoi" class="w-full border border-gray-300 rounded p-2 mb-2">
            <img
              :src="'/img/sellos/' + eventos[editingEvent].motivoi + '.jpg'"
              :alt="'Motivo izquierda'"
              class="w-[300px]"
            >
          </div>
          <div class="w-[300px]">
            <label class="block text-sm text-gray-600">Motivo derecha</label>
            <input v-model="eventos[editingEvent].motivod" class="w-full border border-gray-300 rounded p-2 mb-2">
            <img
              :src="'/img/sellos/' + eventos[editingEvent].motivod + '.jpg'"
              :alt="'Motivo derecha'"
              class="w-[300px]"
            >
          </div>
        </div>
      </div>
    </section>

    <!-- EDITAR PERFILES (collapsible) -->
    <section class="mb-6">
      <div class="bg-amber-400 p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-perfiles"
          v-model="showPerfiles"
          type="checkbox"
          class="cursor-pointer"
        >
        <label for="toggle-perfiles" class="text-black text-lg font-bold cursor-pointer">EDITAR PERFILES</label>
      </div>

      <div v-if="showPerfiles" class="flex flex-col items-center gap-2 p-4">
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Perfil 1</label>
          <input :value="nperfil1" disabled class="w-full border border-gray-300 rounded p-2 bg-gray-100">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Perfil 2</label>
          <input :value="nperfil2" disabled class="w-full border border-gray-300 rounded p-2 bg-gray-100">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Perfil 3</label>
          <input :value="nperfil3" disabled class="w-full border border-gray-300 rounded p-2 bg-gray-100">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Perfil 4</label>
          <input v-model="nperfil4" class="w-full border border-gray-300 rounded p-2">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Perfil 5</label>
          <input :value="nperfil5" disabled class="w-full border border-gray-300 rounded p-2 bg-gray-100">
        </div>
        <div class="w-[250px]">
          <label class="block text-sm text-gray-600">Perfil 6</label>
          <input :value="nperfil6" disabled class="w-full border border-gray-300 rounded p-2 bg-gray-100">
        </div>
      </div>
    </section>

    <!-- TARIFA VIGENTE (collapsible) -->
    <section class="mb-6">
      <div class="bg-amber-400 p-2 mb-2 rounded shadow flex items-center gap-2">
        <input
          id="toggle-tarifas"
          v-model="showTarifas"
          type="checkbox"
          class="cursor-pointer"
        >
        <label for="toggle-tarifas" class="text-black text-lg font-bold cursor-pointer">TARIFA VIGENTE</label>
      </div>

      <div v-if="showTarifas" class="p-4">
        <!-- Tariff template selector -->
        <div class="flex items-center gap-4 mb-4">
          <span class="font-bold text-sm">Plantilla de tarifas:</span>
          <label class="inline-flex items-center gap-1">
            <input v-model="tarifaTemplate" type="radio" value="standard">
            <span class="text-sm">Estándar (A-A2-B-C)</span>
          </label>
          <label class="inline-flex items-center gap-1">
            <input v-model="tarifaTemplate" type="radio" value="america">
            <span class="text-sm">América (A-A2-B-D)</span>
          </label>
          <label class="inline-flex items-center gap-1">
            <input v-model="tarifaTemplate" type="radio" value="andorra">
            <span class="text-sm">Andorra (A-B-C-D)</span>
          </label>
        </div>

        <div class="flex flex-col items-center gap-2">
          <div class="w-[250px]">
            <label class="block text-sm text-gray-600">{{ tarifaLabels[0] }}</label>
            <input v-model="tarifaAPrecio" class="w-full border border-gray-300 rounded p-2">
          </div>
          <div class="w-[250px]">
            <label class="block text-sm text-gray-600">{{ tarifaLabels[1] }}</label>
            <input v-model="tarifaA2Precio" class="w-full border border-gray-300 rounded p-2">
          </div>
          <div class="w-[250px]">
            <label class="block text-sm text-gray-600">{{ tarifaLabels[2] }}</label>
            <input v-model="tarifaBPrecio" class="w-full border border-gray-300 rounded p-2">
          </div>
          <div class="w-[250px]">
            <label class="block text-sm text-gray-600">{{ tarifaLabels[3] }}</label>
            <input v-model="tarifaCPrecio" class="w-full border border-gray-300 rounded p-2">
          </div>
          <div class="flex gap-4">
            <div class="w-[200px]">
              <label class="block text-sm text-gray-600">TIRA Tarifa A</label>
              <input v-model="tarifaTAPrecio" class="w-full border border-gray-300 rounded p-2">
            </div>
            <div class="w-[200px]">
              <label class="block text-sm text-gray-600">TIRA 4 Tarifas</label>
              <input v-model="tarifaT4Precio" class="w-full border border-gray-300 rounded p-2">
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer buttons -->
    <div class="flex justify-center gap-4 p-4">
      <router-link to="/home" class="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded no-underline">
        Cancelar
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useConfig } from '../composables/useConfig'

const router = useRouter()
const { config, updateImprimir } = useConfig()

// UI state
const showPerfiles = ref(false)
const showTarifas = ref(false)
const editingEvent = ref(-1)
const tarifaTemplate = ref<'standard' | 'america' | 'andorra'>('standard')

// Profile names
const nperfil1 = ref('Filatelia')
const nperfil2 = ref('Esporádicos')
const nperfil3 = ref('SPDE')
const nperfil4 = ref('')
const nperfil5 = ref('Abono/Envío')
const nperfil6 = ref('FERIA')

// Profile & event selection
const elperfil = ref(1)
const elevento = ref(0)
const bloqueado = ref('DESBLOQUEADO')

// Current event derived data
const nombreModelo1 = ref('')
const nombreModelo2 = ref('')
const currentFeria = ref('')
const currentLugar = ref('')
const fechaInstalacion = ref('')
const eventoLocalidad = ref('')

// Tariff prices
const tarifaAPrecio = ref<number | string>(0)
const tarifaA2Precio = ref<number | string>(0)
const tarifaBPrecio = ref<number | string>(0)
const tarifaCPrecio = ref<number | string>(0)
const tarifaTAPrecio = ref<number | string>(0)
const tarifaT4Precio = ref<number | string>(0)

// Event data (0-7)
interface EventData {
  nevento: string
  nferia: string
  nlugar: string
  motivoi: string
  motivod: string
  fecha: string
  localidad: string
}

const eventos = reactive<EventData[]>(
  Array.from({ length: 8 }, () => ({
    nevento: '',
    nferia: '',
    nlugar: '',
    motivoi: '',
    motivod: '',
    fecha: '',
    localidad: '',
  }))
)

// Tariff label variations
const tarifaLabels = computed(() => {
  switch (tarifaTemplate.value) {
    case 'america':
      return ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa D']
    case 'andorra':
      return ['Tarifa A', 'Tarifa B', 'Tarifa C', 'Tarifa D']
    default:
      return ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa C']
  }
})

// Sync config data from reactive Meteor subscription to local state
watch(config, (cfg) => {
  if (!cfg) return

  // Profile
  elperfil.value = cfg.sello.elperfil ?? 1
  elevento.value = cfg.sello.elevento ?? 0
  bloqueado.value = (cfg.ticket as any).bloqueado ?? 'DESBLOQUEADO'

  // Profile 4 (the only editable one)
  nperfil4.value = cfg.sello.nperfil4 ?? ''

  // Events data (0-7)
  for (let i = 0; i < 8; i++) {
    eventos[i].nevento = cfg.sello[`nevento${i}`] ?? ''
    eventos[i].nferia = cfg.sello[`nferia${i}`] ?? ''
    eventos[i].nlugar = cfg.sello[`nlugar${i}`] ?? ''
    eventos[i].motivoi = cfg.sello[`motivoi${i}`] ?? ''
    eventos[i].motivod = cfg.sello[`motivod${i}`] ?? ''
    eventos[i].fecha = cfg.sello[`fecha${i}`] ?? ''
    eventos[i].localidad = cfg.sello[`localidad${i}`] ?? ''
  }

  // Tariff prices
  tarifaAPrecio.value = cfg.precios.tarifaA ?? 0
  tarifaA2Precio.value = cfg.precios.tarifaA2 ?? 0
  tarifaBPrecio.value = cfg.precios.tarifaB ?? 0
  tarifaCPrecio.value = cfg.precios.tarifaC ?? 0
  tarifaTAPrecio.value = cfg.precios.tarifaTA ?? 0
  tarifaT4Precio.value = cfg.precios.tarifaT4 ?? 0

  // Derive current event display data
  updateCurrentEventDisplay()
}, { immediate: true })

// Update current event display when elevento changes
watch(elevento, () => {
  updateCurrentEventDisplay()
})

// Also update display when the active event's data changes
watch(
  () => {
    const idx = elevento.value
    if (idx >= 0 && idx < 8) {
      const ev = eventos[idx]
      return `${ev.motivoi}|${ev.motivod}|${ev.nferia}|${ev.nlugar}|${ev.fecha}|${ev.localidad}`
    }
    return ''
  },
  () => {
    updateCurrentEventDisplay()
  }
)

function updateCurrentEventDisplay() {
  const idx = elevento.value
  if (idx >= 0 && idx < 8) {
    const ev = eventos[idx]
    currentFeria.value = ev.nferia
    currentLugar.value = ev.nlugar
    nombreModelo1.value = ev.motivoi
    nombreModelo2.value = ev.motivod
    fechaInstalacion.value = ev.fecha
    eventoLocalidad.value = ev.localidad
  }
}

/**
 * Save configuration by calling the Meteor method updateImprimirConfig.
 * Builds the same structure as the original AngularJS controller's update().
 */
async function guardar() {
  // Determine elnperfil and PERFILlimiteImporte based on elperfil
  let elnperfil = ''
  let PERFILlimiteImporte: number | string = 0

  const perfilNames: Record<number, string> = {
    1: nperfil1.value,
    2: nperfil2.value,
    3: nperfil3.value,
    4: nperfil4.value,
    5: nperfil5.value,
    6: nperfil6.value,
  }
  elnperfil = perfilNames[elperfil.value] ?? ''

  if (config.value) {
    PERFILlimiteImporte = elperfil.value === 6
      ? (config.value.ticket.limiteImporte ?? 0)
      : (config.value.ticket.NUEVOlimiteImporte ?? 0)
  }

  // Derive top-level sello fields from the currently active event
  const activeEvent = eventos[elevento.value]
  const activeModelo1 = activeEvent?.motivoi ?? ''
  const activeModelo2 = activeEvent?.motivod ?? ''
  const activeFecha = activeEvent?.fecha ?? ''
  const activeLocalidad = activeEvent?.localidad ?? ''
  const activeFeria = activeEvent?.nferia ?? ''
  const activeLugar = activeEvent?.nlugar ?? ''

  const updatedConfig = {
    sello: {
      PERFILlimiteImporte,
      nombreModelo1: activeModelo1,
      nombreModelo2: activeModelo2,
      evento: activeLocalidad,
      fecha: activeFecha,
      modelo1: activeModelo1,
      modelo2: activeModelo2,
      modo: config.value?.sello.modo ?? 0,
      elevento: elevento.value,
      elnevento: activeEvent?.nevento ?? '',
      feria: activeFeria,
      lugar: activeLugar,
      elperfil: elperfil.value,
      elnperfil,
      nperfil1: nperfil1.value,
      nperfil2: nperfil2.value,
      nperfil3: nperfil3.value,
      nperfil4: nperfil4.value,
      nperfil5: nperfil5.value,
      nperfil6: nperfil6.value,
      elnmodelo1: activeModelo1,
      elnmodelo2: activeModelo2,
      // Spread all events data
      ...buildEventsPayload(),
    },
    precios: {
      tarifaA: Number(tarifaAPrecio.value),
      tarifaA2: Number(tarifaA2Precio.value),
      tarifaB: Number(tarifaBPrecio.value),
      tarifaC: Number(tarifaCPrecio.value),
      tarifaTA: Number(tarifaTAPrecio.value),
      tarifaT4: Number(tarifaT4Precio.value),
    },
  }

  try {
    await updateImprimir(updatedConfig)
    router.push('/home')
  } catch (error) {
    console.error('Error al guardar configuración:', error)
  }
}

/**
 * Build the flat events payload matching the original structure
 * (nevento0, nferia0, nlugar0, motivoi0, motivod0, fecha0, localidad0, ...)
 */
function buildEventsPayload(): Record<string, string> {
  const payload: Record<string, string> = {}
  for (let i = 0; i < 8; i++) {
    payload[`nevento${i}`] = eventos[i].nevento
    payload[`nferia${i}`] = eventos[i].nferia
    payload[`nlugar${i}`] = eventos[i].nlugar
    payload[`motivoi${i}`] = eventos[i].motivoi
    payload[`motivod${i}`] = eventos[i].motivod
    payload[`fecha${i}`] = eventos[i].fecha
    payload[`localidad${i}`] = eventos[i].localidad
  }
  return payload
}
</script>
