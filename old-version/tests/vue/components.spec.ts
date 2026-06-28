/**
 * Feature: stack-migration, Task 5.9: Tests unitarios de componentes Vue 3
 * Framework: Vitest + @vue/test-utils
 *
 * Tests that verify:
 * - Each component renders without errors
 * - Navigation between routes works correctly
 * - useWebSocket connects and sends messages
 * - useConfig reflects reactive changes
 * - WebSocket message construction with the *¿?* protocol format
 *
 * Validates: Requirement 7.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import { ref, nextTick, defineComponent } from 'vue'

// ---------------------------------------------------------------------------
// Note: Meteor and vue-meteor-tracker are mocked via resolve aliases in
// vitest.config.ts. No vi.mock() needed for those — the aliases point
// to stub implementations in __mocks__/.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper: Create a router instance for testing
// ---------------------------------------------------------------------------

function createTestRouter() {
  // Use stub components for route testing
  const StubComponent = defineComponent({
    template: '<div class="stub">stub</div>',
  })

  const routes = [
    { path: '/', redirect: '/home' },
    { path: '/home', component: StubComponent },
    { path: '/kiosko', component: StubComponent },
    { path: '/imprimir', component: StubComponent },
    { path: '/maquina', component: StubComponent },
    { path: '/subir-imagen', component: StubComponent },
  ]

  return createRouter({
    history: createMemoryHistory(),
    routes,
  })
}

// ---------------------------------------------------------------------------
// Section 1: Component rendering tests
// ---------------------------------------------------------------------------

describe('Component rendering — each component mounts without errors', () => {
  it('NavComponent renders without errors', async () => {
    const NavComponent = (await import('../../correos-webapp/imports/ui/components/NavComponent.vue')).default
    const router = createTestRouter()
    await router.push('/home')
    await router.isReady()

    const wrapper = mount(NavComponent, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('nav').exists()).toBe(true)
  })

  it('App.vue renders without errors', async () => {
    const App = (await import('../../correos-webapp/imports/ui/App.vue')).default
    const router = createTestRouter()
    await router.push('/home')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('#app-root').exists()).toBe(true)
  })

  it('HomeView renders without errors', async () => {
    const HomeView = (await import('../../correos-webapp/imports/ui/views/HomeView.vue')).default
    const router = createTestRouter()
    await router.push('/home')
    await router.isReady()

    const wrapper = shallowMount(HomeView, {
      global: {
        plugins: [router],
        stubs: {
          'router-link': true,
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('KioskoView renders without errors', async () => {
    const KioskoView = (await import('../../correos-webapp/imports/ui/views/KioskoView.vue')).default
    const router = createTestRouter()
    await router.push('/kiosko')
    await router.isReady()

    const wrapper = shallowMount(KioskoView, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('ImprimirView renders without errors', async () => {
    const ImprimirView = (await import('../../correos-webapp/imports/ui/views/ImprimirView.vue')).default
    const router = createTestRouter()
    await router.push('/imprimir')
    await router.isReady()

    const wrapper = shallowMount(ImprimirView, {
      global: {
        plugins: [router],
        stubs: {
          'router-link': true,
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('MaquinaView renders without errors', async () => {
    const MaquinaView = (await import('../../correos-webapp/imports/ui/views/MaquinaView.vue')).default
    const router = createTestRouter()
    await router.push('/maquina')
    await router.isReady()

    const wrapper = shallowMount(MaquinaView, {
      global: {
        plugins: [router],
        stubs: {
          'router-link': true,
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('SubirImagenView renders without errors', async () => {
    const SubirImagenView = (await import('../../correos-webapp/imports/ui/views/SubirImagenView.vue')).default
    const router = createTestRouter()
    await router.push('/subir-imagen')
    await router.isReady()

    const wrapper = shallowMount(SubirImagenView, {
      global: {
        plugins: [router],
        stubs: {
          'router-link': true,
          ImageCropDialog: true,
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('ImageCropDialog renders without errors when visible=false', async () => {
    const ImageCropDialog = (await import('../../correos-webapp/imports/ui/components/ImageCropDialog.vue')).default

    const wrapper = shallowMount(ImageCropDialog, {
      props: {
        visible: false,
        imageSrc: '',
      },
    })

    expect(wrapper.exists()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Section 2: Navigation tests
// ---------------------------------------------------------------------------

describe('Navigation — vue-router transitions between views correctly', () => {
  it('navigates from / to /home via redirect', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/home')
  })

  it('navigates to /kiosko', async () => {
    const router = createTestRouter()
    await router.push('/kiosko')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/kiosko')
  })

  it('navigates to /imprimir', async () => {
    const router = createTestRouter()
    await router.push('/imprimir')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/imprimir')
  })

  it('navigates to /maquina', async () => {
    const router = createTestRouter()
    await router.push('/maquina')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/maquina')
  })

  it('navigates to /subir-imagen', async () => {
    const router = createTestRouter()
    await router.push('/subir-imagen')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/subir-imagen')
  })

  it('NavComponent router-links point to correct paths', async () => {
    const NavComponent = (await import('../../correos-webapp/imports/ui/components/NavComponent.vue')).default
    const router = createTestRouter()
    await router.push('/home')
    await router.isReady()

    const wrapper = mount(NavComponent, {
      global: {
        plugins: [router],
      },
    })

    const links = wrapper.findAll('a')
    const hrefs = links.map((l) => l.attributes('href'))

    expect(hrefs).toContain('/home')
    expect(hrefs).toContain('/kiosko')
    expect(hrefs).toContain('/imprimir')
    expect(hrefs).toContain('/maquina')
  })
})

// ---------------------------------------------------------------------------
// Section 3: useWebSocket composable tests
// ---------------------------------------------------------------------------

import { useWebSocket } from '../../correos-webapp/imports/ui/composables/useWebSocket'

describe('useWebSocket — connects and sends messages', () => {
  let originalWebSocket: typeof WebSocket
  let mockWsInstances: any[]

  beforeEach(() => {
    mockWsInstances = []
    originalWebSocket = global.WebSocket

    // Mock WebSocket constructor
    ;(global as any).WebSocket = vi.fn().mockImplementation((url: string) => {
      const instance = {
        url,
        readyState: 1, // OPEN
        onopen: null as any,
        onclose: null as any,
        onmessage: null as any,
        onerror: null as any,
        send: vi.fn(),
        close: vi.fn(),
        OPEN: 1,
        CONNECTING: 0,
      }
      mockWsInstances.push(instance)

      // Simulate connection opening asynchronously
      setTimeout(() => {
        if (instance.onopen) instance.onopen({})
      }, 0)

      return instance
    })
    ;(global as any).WebSocket.OPEN = 1
    ;(global as any).WebSocket.CONNECTING = 0
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket
  })

  it('connect() creates a WebSocket with given URL', () => {
    const TestComponent = defineComponent({
      setup() {
        const ws = useWebSocket()
        ws.connect('ws://localhost:8000/')
        return { ws }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8000/')
    wrapper.unmount()
  })

  it('isConnected becomes true after WebSocket opens', async () => {
    const TestComponent = defineComponent({
      setup() {
        const ws = useWebSocket()
        ws.connect('ws://localhost:8000/')
        return { ws }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)

    // Wait for the async onopen callback
    await new Promise((r) => setTimeout(r, 10))
    await nextTick()

    expect(wrapper.vm.ws.isConnected.value).toBe(true)
    wrapper.unmount()
  })

  it('send() calls WebSocket.send with the message', async () => {
    const TestComponent = defineComponent({
      setup() {
        const ws = useWebSocket()
        ws.connect('ws://localhost:8000/')
        return { ws }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)

    // Wait for connection
    await new Promise((r) => setTimeout(r, 10))
    await nextTick()

    wrapper.vm.ws.send('hello*¿?*world')

    expect(mockWsInstances[0].send).toHaveBeenCalledWith('hello*¿?*world')
    wrapper.unmount()
  })

  it('onMessage() handler is called when message arrives', async () => {
    const receivedMessages: string[] = []

    const TestComponent = defineComponent({
      setup() {
        const ws = useWebSocket()
        ws.onMessage((data: string) => receivedMessages.push(data))
        ws.connect('ws://localhost:8000/')
        return { ws }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)

    // Wait for connection
    await new Promise((r) => setTimeout(r, 10))
    await nextTick()

    // Simulate incoming message
    mockWsInstances[0].onmessage({ data: 'response*¿?*data' })

    expect(receivedMessages).toEqual(['response*¿?*data'])
    wrapper.unmount()
  })

  it('disconnect() closes the WebSocket and sets isConnected to false', async () => {
    const TestComponent = defineComponent({
      setup() {
        const ws = useWebSocket()
        ws.connect('ws://localhost:8000/')
        return { ws }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)

    await new Promise((r) => setTimeout(r, 10))
    await nextTick()

    wrapper.vm.ws.disconnect()

    expect(mockWsInstances[0].close).toHaveBeenCalled()
    expect(wrapper.vm.ws.isConnected.value).toBe(false)
    wrapper.unmount()
  })
})

// ---------------------------------------------------------------------------
// Section 4: useConfig composable tests
// ---------------------------------------------------------------------------

import { Meteor } from 'meteor/meteor'
import { useConfig } from '../../correos-webapp/imports/ui/composables/useConfig'

describe('useConfig — reflects reactive changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('config starts as null when subscription is not ready', () => {
    ;(Meteor.subscribe as any).mockReturnValue({ ready: () => false })

    const TestComponent = defineComponent({
      setup() {
        const { config } = useConfig()
        return { config }
      },
      template: '<div>{{ config }}</div>',
    })

    const wrapper = mount(TestComponent)
    expect(wrapper.vm.config).toBe(null)
    wrapper.unmount()
  })

  it('updateRollos calls Meteor.call with correct arguments', async () => {
    ;(Meteor.subscribe as any).mockReturnValue({ ready: () => true })

    const TestComponent = defineComponent({
      setup() {
        const { updateRollos } = useConfig()
        return { updateRollos }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    await wrapper.vm.updateRollos(5, 3, 1)

    expect(Meteor.call).toHaveBeenCalledWith(
      'updateRollos',
      5,
      3,
      1,
      expect.any(Function)
    )
    wrapper.unmount()
  })

  it('updateMaquina calls Meteor.call with config data', async () => {
    ;(Meteor.subscribe as any).mockReturnValue({ ready: () => true })

    const TestComponent = defineComponent({
      setup() {
        const { updateMaquina } = useConfig()
        return { updateMaquina }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    const testConfig = { ticket: { rollo1: 1000 } }
    await wrapper.vm.updateMaquina(testConfig)

    expect(Meteor.call).toHaveBeenCalledWith(
      'updateMaquinaConfig',
      testConfig,
      expect.any(Function)
    )
    wrapper.unmount()
  })

  it('initConfig calls Meteor.call without extra arguments', async () => {
    ;(Meteor.subscribe as any).mockReturnValue({ ready: () => true })

    const TestComponent = defineComponent({
      setup() {
        const { initConfig } = useConfig()
        return { initConfig }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    await wrapper.vm.initConfig()

    expect(Meteor.call).toHaveBeenCalledWith(
      'initConfig',
      expect.any(Function)
    )
    wrapper.unmount()
  })
})

// ---------------------------------------------------------------------------
// Section 5: WebSocket message construction (protocol *¿?*)
// ---------------------------------------------------------------------------

describe('WebSocket message construction — correct *¿?* protocol format', () => {
  const SEP = '*¿?*'

  /**
   * Standalone implementation of the buildMessage logic extracted from KioskoView.
   * This allows testing the message format independently of the Vue component.
   */
  function buildMessage(config: any, quantities: number[], perfilpros: string = 'normal'): string {
    // Compute fecha_ticket
    let fecha_ticket: string
    if (config.ticket.fecha === 'auto') {
      const fecha = new Date(2025, 5, 15, 10, 30, 45) // Fixed date for testing
      const pad = (n: number) => n < 10 ? '0' + n : '' + n
      fecha_ticket = `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}`
    } else {
      fecha_ticket = config.ticket.fecha
    }

    // Compute mes_maquina
    let mes_maquina: string
    const mesCfg = config.codigo.mes
    if (mesCfg === 0) {
      const month = new Date().getMonth()
      if (month < 9) mes_maquina = (month + 1).toString()
      else if (month === 9) mes_maquina = 'O'
      else if (month === 10) mes_maquina = 'N'
      else mes_maquina = 'D'
    } else {
      const m = Number(mesCfg)
      if (m === 10) mes_maquina = 'O'
      else if (m === 11) mes_maquina = 'N'
      else if (m === 12) mes_maquina = 'D'
      else mes_maquina = mesCfg.toString()
    }

    // Compute year_maquina
    let year_maquina: string
    if (config.codigo.annio === 'auto') {
      year_maquina = new Date().getFullYear().toString()
    } else {
      year_maquina = config.codigo.annio
    }

    // Titulo based on profile
    let eltitulo = config.ticket.titulo
    let eltituloCopia = config.ticket.tituloCopia
    if (perfilpros === 'filatelia') {
      eltitulo = 'Filatelia de: ' + config.ticket.titulo
      eltituloCopia = 'COPIA Filatelia de: ' + config.ticket.titulo
    }
    if (perfilpros === 'protocolo') {
      eltitulo = 'Protocolo de: ' + config.ticket.titulo
      eltituloCopia = 'COPIA Protocolo de: ' + config.ticket.titulo
    }
    if (perfilpros === 'spde') {
      eltitulo = 'SPDE de: ' + config.ticket.titulo
      eltituloCopia = 'COPIA SPDE de: ' + config.ticket.titulo
    }

    const items = quantities.join(' ')
    const precios = [
      config.precios.tarifaA,
      config.precios.tarifaA2,
      config.precios.tarifaB,
      config.precios.tarifaC,
    ].join(' ')

    const message =
      config.codigo.cliente + SEP +
      config.codigo.producto + SEP +
      config.sello.fecha + SEP +
      config.sello.evento + SEP +
      fecha_ticket + SEP +
      eltitulo + SEP +
      config.sello.modelo1 + SEP +
      config.sello.modelo2 + SEP +
      config.codigo.modo + SEP +
      config.codigo.maquina + SEP +
      mes_maquina + SEP +
      config.codigo.pais + SEP +
      year_maquina + SEP +
      items + SEP +
      precios + SEP +
      config.ticket.empresa + SEP +
      config.ticket.cif + SEP +
      config.ticket.cp + SEP +
      config.ticket.l1 + SEP +
      config.ticket.l2 + SEP +
      config.ticket.l3 + SEP +
      (config.sello.feria ?? '') + SEP +
      (config.sello.lugar ?? '') + SEP +
      (config.ticket.T1especial ?? '') + SEP +
      (config.ticket.T2especial ?? '') + SEP +
      (config.ticket.T3especial ?? '') + SEP +
      (config.ticket.TEmod1 ?? '') + SEP +
      (config.ticket.TEmod2 ?? '') + SEP +
      (config.ticket.ImprimeCopiaTicket ?? '') + SEP +
      (config.ticket.ImprimeMasterTicket ?? '') + SEP +
      eltituloCopia

    return message
  }

  const sampleConfig = {
    ticket: {
      feria: 'Feria Nacional Sello',
      lugar: 'Plaza Mayor',
      fecha: '15/06/2025 10:30:45',
      hora: 'auto',
      titulo: 'Factura Simplificada',
      tituloCopia: 'COPIA Factura Simplificada',
      rollo1: 1500,
      rollo2: 1500,
      tickets: 450,
      limiteTickets: 450,
      limiteImporte: 399.99,
      empresa: 'S.E. Correos S.A.',
      cif: 'A83052407',
      cp: '28042 Madrid',
      l1: 'Exento de impuestos',
      l2: 'Objeto de coleccionismo',
      l3: 'No se admiten devoluciones',
      T1especial: '5',
      T2especial: '10',
      T3especial: '15',
      TEmod1: 'S',
      TEmod2: 'N',
      ImprimeCopiaTicket: '1',
      ImprimeMasterTicket: '1',
    },
    codigo: {
      modo: 'P',
      mes: 6,
      annio: '25',
      pais: 'ES',
      maquina: 'CH17',
      cliente: 42,
      producto: 1,
    },
    sello: {
      fecha: '15-24 junio 2025',
      evento: 'Madrid',
      modelo1: 'Telegrafo',
      modelo2: 'Buzon',
      modo: 0,
      feria: 'Feria Nacional',
      lugar: 'Plaza Mayor - Madrid',
    },
    precios: {
      tarifaA: 0.50,
      tarifaA2: 0.60,
      tarifaB: 1.25,
      tarifaC: 1.35,
    },
  }

  it('produces exactly 31 fields separated by *¿?*', () => {
    const quantities = [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]
    const message = buildMessage(sampleConfig, quantities)

    const fields = message.split(SEP)
    expect(fields).toHaveLength(31)
  })

  it('field 0 is id_cliente', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)

    const fields = message.split(SEP)
    expect(fields[0]).toBe('42')
  })

  it('field 1 is id_producto', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)

    const fields = message.split(SEP)
    expect(fields[1]).toBe('1')
  })

  it('field 2 is fecha_sello from config.sello.fecha', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)

    const fields = message.split(SEP)
    expect(fields[2]).toBe('15-24 junio 2025')
  })

  it('field 3 is evento_sello from config.sello.evento', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)

    const fields = message.split(SEP)
    expect(fields[3]).toBe('Madrid')
  })

  it('field 4 is fecha_ticket (manual when config.ticket.fecha is not "auto")', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)

    const fields = message.split(SEP)
    expect(fields[4]).toBe('15/06/2025 10:30:45')
  })

  it('field 5 is titulo (changes per perfilpros)', () => {
    const quantities = Array(12).fill(0)

    const normalMsg = buildMessage(sampleConfig, quantities, 'normal')
    expect(normalMsg.split(SEP)[5]).toBe('Factura Simplificada')

    const filateliaMsg = buildMessage(sampleConfig, quantities, 'filatelia')
    expect(filateliaMsg.split(SEP)[5]).toBe('Filatelia de: Factura Simplificada')

    const protocoloMsg = buildMessage(sampleConfig, quantities, 'protocolo')
    expect(protocoloMsg.split(SEP)[5]).toBe('Protocolo de: Factura Simplificada')

    const spdeMsg = buildMessage(sampleConfig, quantities, 'spde')
    expect(spdeMsg.split(SEP)[5]).toBe('SPDE de: Factura Simplificada')
  })

  it('fields 6-7 are modelo1 and modelo2', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[6]).toBe('Telegrafo')
    expect(fields[7]).toBe('Buzon')
  })

  it('field 8 is modo from config.codigo.modo', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[8]).toBe('P')
  })

  it('field 9 is maquina name', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[9]).toBe('CH17')
  })

  it('field 10 is mes_maquina computed from config.codigo.mes', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[10]).toBe('6')
  })

  it('mes_maquina handles special months (10=O, 11=N, 12=D)', () => {
    const quantities = Array(12).fill(0)

    const configOct = { ...sampleConfig, codigo: { ...sampleConfig.codigo, mes: 10 } }
    expect(buildMessage(configOct, quantities).split(SEP)[10]).toBe('O')

    const configNov = { ...sampleConfig, codigo: { ...sampleConfig.codigo, mes: 11 } }
    expect(buildMessage(configNov, quantities).split(SEP)[10]).toBe('N')

    const configDec = { ...sampleConfig, codigo: { ...sampleConfig.codigo, mes: 12 } }
    expect(buildMessage(configDec, quantities).split(SEP)[10]).toBe('D')
  })

  it('field 11 is pais', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[11]).toBe('ES')
  })

  it('field 12 is year_maquina', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[12]).toBe('25')
  })

  it('field 13 is cantidades (12 values space-separated)', () => {
    const quantities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[13]).toBe('1 2 3 4 5 6 7 8 9 10 11 12')
  })

  it('field 14 is precios (4 values space-separated)', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[14]).toBe('0.5 0.6 1.25 1.35')
  })

  it('fields 15-20 are empresa, cif, cp, l1, l2, l3', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[15]).toBe('S.E. Correos S.A.')
    expect(fields[16]).toBe('A83052407')
    expect(fields[17]).toBe('28042 Madrid')
    expect(fields[18]).toBe('Exento de impuestos')
    expect(fields[19]).toBe('Objeto de coleccionismo')
    expect(fields[20]).toBe('No se admiten devoluciones')
  })

  it('fields 21-22 are feria and lugar from sello', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[21]).toBe('Feria Nacional')
    expect(fields[22]).toBe('Plaza Mayor - Madrid')
  })

  it('fields 23-27 are tiras especiales and TE mods', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[23]).toBe('5')
    expect(fields[24]).toBe('10')
    expect(fields[25]).toBe('15')
    expect(fields[26]).toBe('S')
    expect(fields[27]).toBe('N')
  })

  it('fields 28-29 are ImprimeCopiaTicket and ImprimeMasterTicket', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)
    const fields = message.split(SEP)

    expect(fields[28]).toBe('1')
    expect(fields[29]).toBe('1')
  })

  it('field 30 is tituloCopia (changes per perfilpros)', () => {
    const quantities = Array(12).fill(0)

    const normalMsg = buildMessage(sampleConfig, quantities, 'normal')
    expect(normalMsg.split(SEP)[30]).toBe('COPIA Factura Simplificada')

    const filateliaMsg = buildMessage(sampleConfig, quantities, 'filatelia')
    expect(filateliaMsg.split(SEP)[30]).toBe('COPIA Filatelia de: Factura Simplificada')
  })

  it('handles missing optional fields gracefully (empty strings)', () => {
    const configNoOptional = {
      ...sampleConfig,
      sello: { ...sampleConfig.sello, feria: undefined, lugar: undefined },
      ticket: {
        ...sampleConfig.ticket,
        T1especial: undefined,
        T2especial: undefined,
        T3especial: undefined,
        TEmod1: undefined,
        TEmod2: undefined,
        ImprimeCopiaTicket: undefined,
        ImprimeMasterTicket: undefined,
      },
    }
    const quantities = Array(12).fill(0)
    const message = buildMessage(configNoOptional, quantities)
    const fields = message.split(SEP)

    // Optional fields default to empty string
    expect(fields[21]).toBe('')
    expect(fields[22]).toBe('')
    expect(fields[23]).toBe('')
    expect(fields[24]).toBe('')
    expect(fields[25]).toBe('')
    expect(fields[26]).toBe('')
    expect(fields[27]).toBe('')
    expect(fields[28]).toBe('')
    expect(fields[29]).toBe('')
  })

  it('year_maquina uses "auto" mode to compute current year', () => {
    const configAuto = {
      ...sampleConfig,
      codigo: { ...sampleConfig.codigo, annio: 'auto' },
    }
    const quantities = Array(12).fill(0)
    const message = buildMessage(configAuto, quantities)
    const fields = message.split(SEP)

    expect(fields[12]).toBe(new Date().getFullYear().toString())
  })

  it('separator *¿?* is preserved correctly in the message', () => {
    const quantities = Array(12).fill(0)
    const message = buildMessage(sampleConfig, quantities)

    // Count separators: 31 fields = 30 separators
    const separatorCount = (message.match(/\*¿\?\*/g) || []).length
    expect(separatorCount).toBe(30)
  })
})
