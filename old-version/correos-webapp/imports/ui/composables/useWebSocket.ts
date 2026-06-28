import { ref, onUnmounted } from 'vue'

export interface UseWebSocketOptions {
  /** Maximum number of reconnection attempts (default: Infinity) */
  maxRetries?: number
  /** Initial delay in ms before first reconnection attempt (default: 1000) */
  initialDelay?: number
  /** Maximum delay in ms between reconnection attempts (default: 30000) */
  maxDelay?: number
}

export interface UseWebSocket {
  connect(url: string): void
  send(message: string): void
  onMessage(handler: (data: string) => void): void
  disconnect(): void
  isConnected: import('vue').Ref<boolean>
}

/**
 * Composable for WebSocket connection with automatic reconnection using
 * exponential backoff. Replaces the raw WebSocket handling from the legacy
 * AngularJS kiosko component.
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocket {
  const {
    maxRetries = Infinity,
    initialDelay = 1000,
    maxDelay = 30000,
  } = options

  const isConnected = ref(false)

  let ws: WebSocket | null = null
  let url: string = ''
  let retryCount = 0
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  let intentionalClose = false
  const messageHandlers: Array<(data: string) => void> = []

  function connect(wsUrl: string): void {
    url = wsUrl
    intentionalClose = false
    retryCount = 0
    createConnection()
  }

  function createConnection(): void {
    if (ws) {
      ws.onopen = null
      ws.onclose = null
      ws.onmessage = null
      ws.onerror = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }

    ws = new WebSocket(url)

    ws.onopen = () => {
      isConnected.value = true
      retryCount = 0
      console.log('[useWebSocket] connected')
    }

    ws.onclose = () => {
      isConnected.value = false
      console.log('[useWebSocket] disconnected')
      if (!intentionalClose) {
        scheduleReconnect()
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? event.data : String(event.data)
      for (const handler of messageHandlers) {
        handler(data)
      }
    }

    ws.onerror = (event: Event) => {
      console.error('[useWebSocket] error', event)
      // onclose will fire after onerror, triggering reconnection
    }
  }

  function scheduleReconnect(): void {
    if (retryCount >= maxRetries) {
      console.warn('[useWebSocket] max retries reached, giving up')
      return
    }

    // Exponential backoff with jitter
    const delay = Math.min(initialDelay * Math.pow(2, retryCount), maxDelay)
    const jitter = delay * 0.2 * Math.random()
    const totalDelay = delay + jitter

    console.log(`[useWebSocket] reconnecting in ${Math.round(totalDelay)}ms (attempt ${retryCount + 1})`)

    retryTimeout = setTimeout(() => {
      retryCount++
      createConnection()
    }, totalDelay)
  }

  function send(message: string): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[useWebSocket] cannot send, not connected')
      return
    }
    ws.send(message)
  }

  function onMessage(handler: (data: string) => void): void {
    messageHandlers.push(handler)
  }

  function disconnect(): void {
    intentionalClose = true
    if (retryTimeout !== null) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
    isConnected.value = false
  }

  // Cleanup on component unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    connect,
    send,
    onMessage,
    disconnect,
    isConnected,
  }
}
