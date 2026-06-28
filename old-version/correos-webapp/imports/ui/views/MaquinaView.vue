<template>
  <div class="p-4 bg-gray-100 min-h-screen">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2">
      <p class="text-black text-[25px] font-bold text-center">MÁQUINA</p>
      <button
        class="bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500"
        @click="guardar"
      >
        Guardar
      </button>
      <p class="text-gray-500 text-[25px] font-bold text-center">CÓDIGO - TICKET - ROLLOS</p>
    </div>

    <!-- Main form area -->
    <div class="flex justify-center mt-4">
      <div class="w-full max-w-7xl px-4">

        <!-- Section 1: CÓDIGO ETIQUETA (collapsible) -->
        <div
          class="bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2"
          @click="showCodigo = !showCodigo"
        >
          <input type="checkbox" :checked="showCodigo" class="cursor-pointer" @click.stop="showCodigo = !showCodigo">
          <h3 class="text-base font-bold m-0">CÓDIGO ETIQUETA: {{ displayMes }}-{{ nombre }}</h3>
        </div>

        <div v-show="showCodigo" class="border border-gray-200 rounded-b p-4 bg-white">
          <div class="flex flex-wrap items-start gap-4">
            <!-- Modo -->
            <div class="flex flex-col">
              <label class="text-xs text-gray-600">Modo</label>
              <input
                v-model="modo"
                maxlength="1"
                class="w-12 border-b border-gray-400 focus:border-blue-500 outline-none text-center"
              >
            </div>

            <!-- Mes -->
            <div class="flex flex-col">
              <label class="text-xs text-gray-600">Mes</label>
              <select v-model="mes" class="border-b border-gray-400 text-red-600 outline-none">
                <option :value="0">Auto</option>
                <option :value="1">1</option>
                <option :value="2">2</option>
                <option :value="3">3</option>
                <option :value="4">4</option>
                <option :value="5">5</option>
                <option :value="6">6</option>
                <option :value="7">7</option>
                <option :value="8">8</option>
                <option :value="9">9</option>
                <option :value="10">O</option>
                <option :value="11">N</option>
                <option :value="12">D</option>
              </select>
            </div>

            <!-- País -->
            <div class="flex flex-col">
              <label class="text-xs text-gray-600">País</label>
              <input
                v-model="pais"
                maxlength="2"
                class="w-12 border-b border-gray-400 focus:border-blue-500 outline-none text-center"
              >
            </div>

            <!-- Año -->
            <div class="flex flex-col">
              <label class="text-xs text-gray-600">Año</label>
              <select v-model="modoAnnio" class="border-b border-gray-400 outline-none">
                <option value="1">Auto</option>
                <option value="2">Manual</option>
              </select>
              <input
                v-if="modoAnnio === '2'"
                v-model.number="annioManual"
                type="number"
                min="0"
                max="99"
                class="w-16 mt-1 border-b border-gray-400 outline-none"
                placeholder="Año"
              >
            </div>

            <!-- Código Evento -->
            <div class="flex flex-col">
              <label class="text-xs text-gray-600">Código Evento</label>
              <input
                v-model="nombre"
                minlength="4"
                maxlength="4"
                class="w-20 border-b border-gray-400 text-red-600 focus:border-blue-500 outline-none"
              >
              <button class="mt-1 bg-[rgb(255,124,56)] text-white text-xs px-2 py-1 rounded" @click="guardar">
                (MD--) (FI--): NO imprime LOGO ni TICKET por TIRA
              </button>
              <button class="mt-1 bg-[rgb(255,124,56)] text-white text-xs px-2 py-1 rounded" @click="guardar">
                (FI--): NO imprime FECHA ni EVENTO en las ETIQUETAS
              </button>
            </div>

            <!-- ID Cliente -->
            <div class="flex flex-col">
              <label class="text-xs text-gray-600">ID Cliente</label>
              <input
                v-model="idCliente"
                class="w-24 border-b border-gray-400 text-red-600 focus:border-blue-500 outline-none"
              >
              <button class="mt-1 bg-gray-200 text-xs px-2 py-1 rounded hover:bg-gray-300" @click="idCliente = '1'">
                Reset al inicio del año ATM NACIONAL=1
              </button>
              <button class="mt-1 bg-gray-200 text-xs px-2 py-1 rounded hover:bg-gray-300" @click="idCliente = '5001'">
                Reset al inicio del año i7 Mojave=5001
              </button>
            </div>

            <!-- ID Producto -->
            <div class="flex flex-col">
              <label class="text-xs text-gray-600">ID Producto</label>
              <input
                :value="idProducto"
                disabled
                class="w-16 border-b border-gray-300 text-gray-500 outline-none bg-transparent"
              >
            </div>
          </div>
        </div>

        <!-- Section 2: TICKET (collapsible) -->
        <div
          class="bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2 mt-4"
          @click="showTicket = !showTicket"
        >
          <input type="checkbox" :checked="showTicket" class="cursor-pointer" @click.stop="showTicket = !showTicket">
          <h3 class="text-base font-bold m-0">
            TICKET: {{ titulo }} - COPIA TICKET: {{ ImprimeCopiaTicket }} - MASTER TICKET: {{ ImprimeMasterTicket }}
          </h3>
        </div>

        <div v-show="showTicket" class="border border-gray-200 rounded-b p-4 bg-white">
          <div class="flex gap-8">
            <!-- Left column -->
            <div class="flex-1 flex flex-col gap-2">
              <div class="bg-gray-100 p-2 rounded shadow-sm">
                <h3 class="text-sm font-bold m-0">Cabecera Ticket</h3>
              </div>
              <p class="text-xl font-bold text-center">{{ feria }}<br>{{ lugar }}</p>

              <div class="bg-gray-100 p-2 rounded shadow-sm">
                <h3 class="text-sm font-bold m-0">Empresa</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Empresa</label>
                <input v-model="empresa" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">CIF</label>
                <input v-model="cif" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">CP Población</label>
                <input v-model="cp" class="w-[400px] border-b border-gray-400 outline-none">
              </div>

              <div class="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h3 class="text-sm font-bold m-0">Pié del Ticket</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Detalle línea 1</label>
                <input v-model="l1" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Detalle línea 2</label>
                <input v-model="l2" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Detalle línea 3</label>
                <input v-model="l3" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
            </div>

            <!-- Right column -->
            <div class="flex-1 flex flex-col gap-2">
              <div class="bg-gray-100 p-2 rounded shadow-sm">
                <h3 class="text-sm font-bold m-0">Tipo de Documento</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Título ticket (Sólo Perfil FERIA)</label>
                <input v-model="eltitulo" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Título ticket copia (Perfil Activo)</label>
                <input :value="tituloCopia" disabled class="w-[400px] border-b border-gray-300 text-gray-500 outline-none bg-transparent">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Límite importe sólo FERIA</label>
                <input v-model="limiteImporte" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">NUEVO Límite importe EXCEPTO FERIA</label>
                <input v-model="NUEVOlimiteImporte" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
              </div>

              <div class="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h3 class="text-sm font-bold m-0">Modo Fecha Ticket</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Fecha</label>
                <select v-model="modoFecha" class="border-b border-gray-400 outline-none">
                  <option value="1">Automático</option>
                  <option value="2">Manual</option>
                </select>
              </div>
              <div v-if="modoFecha === '2'" class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Fecha</label>
                <input v-model="fechaManual" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Hora</label>
                <select v-model="modoHora" class="border-b border-gray-400 outline-none">
                  <option value="1">Automático</option>
                  <option value="2">Manual</option>
                </select>
              </div>
              <div v-if="modoHora === '2'" class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">Hora</label>
                <input v-model="horaManual" class="w-[400px] border-b border-gray-400 outline-none">
              </div>

              <div class="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h3 class="text-sm font-bold m-0">COPIA Ticket para CAJA</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">IMPRIMIR COPIA TICKET S/N</label>
                <input v-model="ImprimeCopiaTicket" maxlength="1" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
              </div>

              <div class="bg-red-600 text-white p-2 rounded shadow-sm mt-2">
                <h3 class="text-sm font-bold m-0">IMPRIME SIEMPRE TICKET MASTER SET: VENDER 5 TIRAS DE 4 TARIFAS CADA VEZ</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">IMPRIMIR TICKET MASTER SET S/N</label>
                <input v-model="ImprimeMasterTicket" maxlength="1" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
              </div>
            </div>
          </div>
        </div>

        <!-- Section: Máximo Nº de Tickets -->
        <div class="flex flex-col items-center mt-4">
          <div class="bg-gray-100 p-2 rounded shadow-sm">
            <h3 class="text-sm font-bold m-0">Máximo Nº de Tickets</h3>
          </div>
          <div class="flex flex-col gap-1 mt-2">
            <label class="text-xs text-gray-600">Cantidad por Rollo</label>
            <input v-model="limiteTickets" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
          </div>
          <div class="bg-[rgb(51,102,153)] rounded p-4 mt-2 flex flex-col items-center">
            <label class="text-xs text-white">Rollo Tickets</label>
            <input v-model="tickets" class="w-32 text-center text-white bg-transparent border-b border-white outline-none">
            <button class="mt-2 bg-white text-black px-3 py-1 rounded text-sm" @click="tickets = limiteTickets">
              Reset
            </button>
          </div>
        </div>

        <!-- Section: ROLLOS ETIQUETAS EN MÁQUINA -->
        <div class="bg-[rgb(255,192,0)] p-2 rounded mt-4">
          <h3 class="text-base font-bold m-0">ROLLOS ETIQUETAS EN MÁQUINA</h3>
        </div>

        <div class="flex justify-center gap-8 mt-4">
          <!-- Rollo 1 -->
          <div class="flex flex-col items-center">
            <img :src="'/img/sellos/' + nombreModelo1 + '.jpg'" alt="Modelo 1" class="w-[300px]">

            <div v-if="rollo1 != -1">
              <div class="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h3 class="text-sm font-bold m-0">Motivo {{ nombreModelo1 }}</h3>
              </div>
              <div class="flex flex-col gap-1 mt-1">
                <label class="text-xs text-gray-600">Existencias</label>
                <input v-model="rollo1" class="w-[400px] border-b border-gray-400 text-xl outline-none">
              </div>
              <div class="flex flex-col gap-1 mt-1">
                <label class="text-xs text-gray-600">VISUAL: etiquetas en rollo</label>
                <input v-model="cv1" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <button
                class="mt-2 bg-[rgb(153,38,0)] text-white px-4 py-2 rounded font-semibold"
                @click="quitarRollo1"
              >
                CONFIRMAR ROLLO QUITADO
              </button>
            </div>
          </div>

          <!-- Spacer -->
          <div class="w-8"></div>

          <!-- Rollo 2 -->
          <div class="flex flex-col items-center">
            <img :src="'/img/sellos/' + nombreModelo2 + '.jpg'" alt="Modelo 2" class="w-[300px]">

            <div v-if="rollo2 != -1">
              <div class="bg-gray-100 p-2 rounded shadow-sm mt-2">
                <h3 class="text-sm font-bold m-0">Motivo {{ nombreModelo2 }}</h3>
              </div>
              <div class="flex flex-col gap-1 mt-1">
                <label class="text-xs text-gray-600">Existencias</label>
                <input v-model="rollo2" class="w-[400px] border-b border-gray-400 text-xl outline-none">
              </div>
              <div class="flex flex-col gap-1 mt-1">
                <label class="text-xs text-gray-600">VISUAL: etiquetas en rollo</label>
                <input v-model="cv2" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <button
                class="mt-2 bg-[rgb(153,38,0)] text-white px-4 py-2 rounded font-semibold"
                @click="quitarRollo2"
              >
                CONFIRMAR ROLLO QUITADO
              </button>
            </div>
          </div>
        </div>

        <!-- INSTALAR ROLLOS ETIQUETAS -->
        <div class="bg-[rgb(51,102,153)] text-white p-2 rounded mt-4">
          <h3 class="text-base font-bold m-0">INSTALAR ROLLOS ETIQUETAS</h3>
        </div>

        <div class="flex justify-center gap-8 mt-4">
          <!-- Install Rollo 1 -->
          <div v-if="rollo1 == -1" class="flex flex-col items-center">
            <div class="bg-gray-100 p-2 rounded shadow-sm">
              <h3 class="text-sm font-bold m-0">Colocar rollo {{ nombreModelo1 }}</h3>
            </div>
            <div class="flex flex-col gap-1 mt-2">
              <label class="text-xs text-gray-600">Etiquetas en rollo</label>
              <input v-model.number="cantidad1" type="number" class="w-[400px] border-b border-gray-400 outline-none">
            </div>
            <div class="flex flex-col gap-1 mt-1">
              <label class="text-xs text-gray-600">Desechadas en la instalación</label>
              <input v-model.number="desechadas1" type="number" class="w-[400px] border-b border-gray-400 outline-none">
            </div>
            <button
              class="mt-2 bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500"
              @click="colocarRollo1"
            >
              CONFIRMAR COLOCACIÓN ROLLO
            </button>
          </div>

          <div class="w-8"></div>

          <!-- Install Rollo 2 -->
          <div v-if="rollo2 == -1" class="flex flex-col items-center">
            <div class="bg-gray-100 p-2 rounded shadow-sm">
              <h3 class="text-sm font-bold m-0">Colocar rollo {{ nombreModelo2 }}</h3>
            </div>
            <div class="flex flex-col gap-1 mt-2">
              <label class="text-xs text-gray-600">Etiquetas en rollo</label>
              <input v-model.number="cantidad2" type="number" class="w-[400px] border-b border-gray-400 outline-none">
            </div>
            <div class="flex flex-col gap-1 mt-1">
              <label class="text-xs text-gray-600">Desechadas en la instalación</label>
              <input v-model.number="desechadas2" type="number" class="w-[400px] border-b border-gray-400 outline-none">
            </div>
            <button
              class="mt-2 bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500"
              @click="colocarRollo2"
            >
              CONFIRMAR COLOCACIÓN ROLLO
            </button>
          </div>
        </div>

        <!-- Blocked/Unblocked indicator -->
        <div class="flex justify-center mt-4">
          <div
            v-if="Number(rollo1) + Number(rollo2) === -2"
            class="bg-[rgb(0,153,51)] rounded px-4 py-2"
          >
            <span class="text-white text-xl font-bold">DESBLOQUEADO</span>
          </div>
          <div
            v-else
            class="bg-[rgb(153,38,0)] rounded px-4 py-2"
          >
            <span class="text-white text-xl font-bold">BLOQUEADO</span>
          </div>
        </div>

        <!-- Section 3: TIRAS ESPECIALES (collapsible) -->
        <div
          class="bg-[rgb(255,192,0)] p-2 rounded cursor-pointer flex items-center gap-2 mt-4"
          @click="showTiras = !showTiras"
        >
          <input type="checkbox" :checked="showTiras" class="cursor-pointer" @click.stop="showTiras = !showTiras">
          <h3 class="text-base font-bold m-0">
            TIRAS ESPECIALES {{ nombreModelo1 }}: {{ TEmod1 }} / {{ nombreModelo2 }}: {{ TEmod2 }}
          </h3>
        </div>

        <div v-show="showTiras" class="border border-gray-200 rounded-b p-4 bg-white">
          <div class="flex gap-8">
            <!-- Left column -->
            <div class="flex-1 flex flex-col gap-2">
              <div class="bg-gray-100 p-2 rounded shadow-sm">
                <h3 class="text-sm font-bold m-0">(NO dejar en blanco) IMPORTE € DE VENTA para:</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">1 TIRA ESPECIAL (0 = ANULA LA TIRA)</label>
                <input v-model.number="T1especial" type="number" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">2 TIRAS ESPECIALES (0 = ANULA LA TIRA)</label>
                <input v-model.number="T2especial" type="number" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">3 TIRAS ESPECIALES (0 = ANULA LA TIRA)</label>
                <input v-model.number="T3especial" type="number" class="w-[400px] border-b border-gray-400 outline-none">
              </div>
            </div>

            <!-- Right column -->
            <div class="flex-1 flex flex-col gap-2">
              <div class="bg-gray-100 p-2 rounded shadow-sm">
                <h3 class="text-sm font-bold m-0">IMPRIMIR TIRA ESPECIAL S/N</h3>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">MODELO 1: {{ nombreModelo1 }}</label>
                <input v-model="TEmod1" maxlength="1" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-600">MODELO 2: {{ nombreModelo2 }}</label>
                <input v-model="TEmod2" maxlength="1" class="w-[400px] border-b border-gray-400 text-red-600 outline-none">
              </div>
            </div>
          </div>
        </div>

        <!-- Footer buttons -->
        <div class="flex justify-center items-center gap-4 mt-6 mb-4">
          <button
            class="bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500"
            @click="guardar"
          >
            Guardar
          </button>
          <router-link to="/home" class="bg-gray-200 text-black px-4 py-2 rounded font-semibold hover:bg-gray-300 no-underline">
            Cancelar
          </router-link>
          <button
            class="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
            @click="exportarXLS"
          >
            Exportar XLS
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConfig } from '../composables/useConfig'
import { useOrders, type OrderLine } from '../composables/useOrders'

const router = useRouter()
const { config, updateMaquina } = useConfig()
const { insertOrder, downloadXLS } = useOrders()

// --- Collapsible section states ---
const showCodigo = ref(false)
const showTicket = ref(false)
const showTiras = ref(false)

// --- Editable form state ---
// Código
const modo = ref('')
const mes = ref<number | string>(0)
const pais = ref('')
const modoAnnio = ref('1')
const annioManual = ref<number | string>('')
const nombre = ref('')
const idCliente = ref('')
const idProducto = ref('001')

// Ticket
const eltitulo = ref('')
const titulo = ref('')
const tituloCopia = ref('')
const modoFecha = ref('1')
const fechaManual = ref('')
const modoHora = ref('1')
const horaManual = ref('')
const limiteImporte = ref<number | string>('')
const NUEVOlimiteImporte = ref<number | string>('')
const rollo1 = ref<number | string>(0)
const rollo2 = ref<number | string>(0)
const tickets = ref<number | string>(0)
const limiteTickets = ref<number | string>(0)
const empresa = ref('')
const cif = ref('')
const cp = ref('')
const l1 = ref('')
const l2 = ref('')
const l3 = ref('')
const T1especial = ref<number | string>(0)
const T2especial = ref<number | string>(0)
const T3especial = ref<number | string>(0)
const TEmod1 = ref('')
const TEmod2 = ref('')
const ImprimeCopiaTicket = ref('')
const ImprimeMasterTicket = ref('')
const bloqueado = ref('')
const rollo1ant = ref(0)
const rollo2ant = ref(0)

// Sello derived (read-only display)
const feria = ref('')
const lugar = ref('')
const nombreModelo1 = ref('')
const nombreModelo2 = ref('')
const elnperfil = ref('')

// Roll installation fields
const cantidad1 = ref(0)
const desechadas1 = ref(0)
const cantidad2 = ref(0)
const desechadas2 = ref(0)
const cv1 = ref(0)
const cv2 = ref(0)

// Computed display for mes in header
const displayMes = ref('Automático')

// --- Sync config to local form state when reactive data changes ---
watch(config, (cfg) => {
  if (!cfg) return

  // Código fields
  modo.value = cfg.codigo.modo ?? ''
  mes.value = cfg.codigo.mes ?? 0
  pais.value = cfg.codigo.pais ?? ''
  nombre.value = cfg.codigo.maquina ?? ''
  idCliente.value = String(cfg.codigo.cliente ?? '')
  idProducto.value = String(cfg.codigo.producto ?? '001')

  if (cfg.codigo.annio === 'auto') {
    modoAnnio.value = '1'
  } else {
    modoAnnio.value = '2'
    annioManual.value = cfg.codigo.annio
  }

  // Ticket fields
  eltitulo.value = cfg.ticket.eltitulo ?? ''
  limiteImporte.value = cfg.ticket.limiteImporte ?? ''
  NUEVOlimiteImporte.value = (cfg.ticket as any).NUEVOlimiteImporte ?? ''
  rollo1.value = cfg.ticket.rollo1 ?? 0
  rollo2.value = cfg.ticket.rollo2 ?? 0
  rollo1ant.value = (cfg.ticket as any).rollo1ant ?? 0
  rollo2ant.value = (cfg.ticket as any).rollo2ant ?? 0
  tickets.value = cfg.ticket.tickets ?? 0
  limiteTickets.value = cfg.ticket.limiteTickets ?? 0
  empresa.value = cfg.ticket.empresa ?? ''
  cif.value = cfg.ticket.cif ?? ''
  cp.value = cfg.ticket.cp ?? ''
  l1.value = cfg.ticket.l1 ?? ''
  l2.value = cfg.ticket.l2 ?? ''
  l3.value = cfg.ticket.l3 ?? ''
  T1especial.value = cfg.ticket.T1especial ?? 0
  T2especial.value = cfg.ticket.T2especial ?? 0
  T3especial.value = cfg.ticket.T3especial ?? 0
  TEmod1.value = cfg.ticket.TEmod1 ?? ''
  TEmod2.value = cfg.ticket.TEmod2 ?? ''
  ImprimeCopiaTicket.value = cfg.ticket.ImprimeCopiaTicket ?? ''
  ImprimeMasterTicket.value = cfg.ticket.ImprimeMasterTicket ?? ''
  bloqueado.value = (cfg.ticket as any).bloqueado ?? ''

  // Fecha / hora modes
  if (cfg.ticket.fecha === 'auto') {
    modoFecha.value = '1'
  } else {
    modoFecha.value = '2'
    fechaManual.value = cfg.ticket.fecha
  }
  if (cfg.ticket.hora === 'auto') {
    modoHora.value = '1'
  } else {
    modoHora.value = '2'
    horaManual.value = cfg.ticket.hora
  }

  // Titulo logic
  if (cfg.sello.elnperfil === 'FERIA') {
    titulo.value = cfg.ticket.eltitulo ?? ''
    tituloCopia.value = 'COPIA ' + (cfg.ticket.eltitulo ?? '')
  } else {
    titulo.value = cfg.sello.elnperfil ?? ''
    tituloCopia.value = 'COPIA ' + (cfg.sello.elnperfil ?? '')
  }

  // Sello display fields
  feria.value = cfg.sello.feria ?? ''
  lugar.value = cfg.sello.lugar ?? ''
  const evIdx = cfg.sello.elevento ?? 0
  nombreModelo1.value = cfg.sello[`motivoi${evIdx}`] ?? (cfg.sello as any).elnmodelo1 ?? ''
  nombreModelo2.value = cfg.sello[`motivod${evIdx}`] ?? (cfg.sello as any).elnmodelo2 ?? ''
  elnperfil.value = cfg.sello.elnperfil ?? ''

  // Display mes
  if (cfg.codigo.mes === 0) {
    displayMes.value = 'Automático'
  } else {
    displayMes.value = String(cfg.codigo.mes)
  }
}, { immediate: true })

// --- Actions ---

/**
 * Saves the machine configuration to the server via Meteor method.
 */
async function guardar(): Promise<void> {
  const updatedConfig: any = {
    ticket: {
      bloqueado: bloqueado.value,
      eltitulo: eltitulo.value,
      titulo: titulo.value,
      tituloCopia: tituloCopia.value,
      rollo1: parseInt(String(rollo1.value)),
      rollo2: parseInt(String(rollo2.value)),
      rollo1ant: parseInt(String(rollo1ant.value)),
      rollo2ant: parseInt(String(rollo2ant.value)),
      tickets: parseInt(String(tickets.value)),
      limiteTickets: parseInt(String(limiteTickets.value)),
      empresa: empresa.value,
      cif: cif.value,
      cp: cp.value,
      l1: l1.value,
      l2: l2.value,
      l3: l3.value,
      T1especial: parseInt(String(T1especial.value)),
      T2especial: parseInt(String(T2especial.value)),
      T3especial: parseInt(String(T3especial.value)),
      TEmod1: TEmod1.value,
      TEmod2: TEmod2.value,
      ImprimeCopiaTicket: ImprimeCopiaTicket.value,
      ImprimeMasterTicket: ImprimeMasterTicket.value,
      NUEVOlimiteImporte: NUEVOlimiteImporte.value,
      limiteImporte: limiteImporte.value,
      fecha: modoFecha.value === '1' ? 'auto' : fechaManual.value,
      hora: modoHora.value === '1' ? 'auto' : horaManual.value,
    },
    codigo: {
      modo: modo.value,
      elmes: displayMes.value,
      mes: mes.value,
      pais: pais.value,
      maquina: nombre.value,
      cliente: parseInt(String(idCliente.value)),
      producto: parseInt(String(idProducto.value)),
      annio: modoAnnio.value === '1' ? 'auto' : annioManual.value,
    },
  }

  try {
    await updateMaquina(updatedConfig)
    router.push('/maquina')
  } catch (err) {
    console.error('Error saving config:', err)
  }
}

/**
 * Registers the removal of roll 1 and logs an order entry.
 */
async function quitarRollo1(): Promise<void> {
  const orderLine: OrderLine = {
    event: 'QUITAR ROLLO 1',
    venue: ' ',
    machine: ' ',
    vendType: ' ',
    productName: ' ',
    transactionDate: '',
    quantity: 0,
    quantitySet: 0,
    totalStamps: 0,
    currency: ' ',
    value: 0,
    paymentStatus: ' ',
    sesionId: 0,
    etiquetasRollo1: 0,
    etiquetasRollo2: 0,
    etiquetaMes: ' ',
    titutoEvento: ' ',
    feria: ' ',
    Lugar: ' ',
    fecha: ' ',
    mes: ' ',
    annio: ' ',
    documento: ' ',
  }
  // Mark as "QUITADO" in order log
  ;(orderLine as any).etiquetasRollo1 = 'QUITADO'

  try {
    await insertOrder([orderLine])
  } catch (err) {
    console.error('Error registering roll removal:', err)
  }
  rollo1.value = -1
  cv1.value = 0
}

/**
 * Registers the removal of roll 2 and logs an order entry.
 */
async function quitarRollo2(): Promise<void> {
  const orderLine: OrderLine = {
    event: 'QUITAR ROLLO 2',
    venue: ' ',
    machine: ' ',
    vendType: ' ',
    productName: ' ',
    transactionDate: '',
    quantity: 0,
    quantitySet: 0,
    totalStamps: 0,
    currency: ' ',
    value: 0,
    paymentStatus: ' ',
    sesionId: 0,
    etiquetasRollo1: 0,
    etiquetasRollo2: 0,
    etiquetaMes: ' ',
    titutoEvento: ' ',
    feria: ' ',
    Lugar: ' ',
    fecha: ' ',
    mes: ' ',
    annio: ' ',
    documento: ' ',
  }
  ;(orderLine as any).etiquetasRollo2 = 'QUITADO'

  try {
    await insertOrder([orderLine])
  } catch (err) {
    console.error('Error registering roll removal:', err)
  }
  rollo2.value = -1
  cv2.value = 0
}

/**
 * Registers the placement of roll 1, computing net labels.
 */
async function colocarRollo1(): Promise<void> {
  const orderLine: OrderLine = {
    event: 'COLOCAR ROLLO 1',
    venue: ' ',
    machine: ' ',
    vendType: ' ',
    productName: ' ',
    transactionDate: '',
    quantity: 0,
    quantitySet: 0,
    totalStamps: 0,
    currency: ' ',
    value: 0,
    paymentStatus: ' ',
    sesionId: 0,
    etiquetasRollo1: 0,
    etiquetasRollo2: 0,
    etiquetaMes: ' ',
    titutoEvento: ' ',
    feria: ' ',
    Lugar: ' ',
    fecha: ' ',
    mes: ' ',
    annio: ' ',
    documento: ' ',
  }
  ;(orderLine as any).etiquetasRollo1 = 'COLOCADO'

  try {
    await insertOrder([orderLine])
  } catch (err) {
    console.error('Error registering roll placement:', err)
  }
  rollo1.value = (cantidad1.value || 0) - (desechadas1.value || 0)
}

/**
 * Registers the placement of roll 2, computing net labels.
 */
async function colocarRollo2(): Promise<void> {
  const orderLine: OrderLine = {
    event: 'COLOCAR ROLLO 2',
    venue: ' ',
    machine: ' ',
    vendType: ' ',
    productName: ' ',
    transactionDate: '',
    quantity: 0,
    quantitySet: 0,
    totalStamps: 0,
    currency: ' ',
    value: 0,
    paymentStatus: ' ',
    sesionId: 0,
    etiquetasRollo1: 0,
    etiquetasRollo2: 0,
    etiquetaMes: ' ',
    titutoEvento: ' ',
    feria: ' ',
    Lugar: ' ',
    fecha: ' ',
    mes: ' ',
    annio: ' ',
    documento: ' ',
  }
  ;(orderLine as any).etiquetasRollo2 = 'COLOCADO'

  try {
    await insertOrder([orderLine])
  } catch (err) {
    console.error('Error registering roll placement:', err)
  }
  rollo2.value = (cantidad2.value || 0) - (desechadas2.value || 0)
}

/**
 * Exports orders as CSV file (XLS-compatible).
 */
async function exportarXLS(): Promise<void> {
  try {
    const fileContent = await downloadXLS()
    if (fileContent) {
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'reporte-ATM.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.error('Error exporting XLS:', err)
  }
}
</script>
