/**
 * SvvS Kiosko - Web de descarga con autenticación
 *
 * Flujo:
 * 1. Usuario introduce credenciales
 * 2. POST /api/login → recibe token + datos usuario
 * 3. Se muestra sección de descarga con mensaje de bienvenida
 * 4. Al pulsar descargar → GET /api/download con token
 * 5. Se descarga el .exe desde presigned URL + se genera config.json local
 */

;(function () {
  'use strict'

  // ============================================================================
  // Configuración
  // ============================================================================
  // API_BASE se configura con la URL del API Gateway (se sustituye tras desplegar)
  const API_BASE = window.API_BASE || 'https://REPLACE_WITH_API_GATEWAY_URL/prod/api'

  // ============================================================================
  // Estado
  // ============================================================================
  let authToken = null
  let userData = null

  // ============================================================================
  // Elementos DOM
  // ============================================================================
  const loginSection = document.getElementById('login-section')
  const downloadSection = document.getElementById('download-section')
  const instructionsSection = document.getElementById('instructions-section')
  const loginForm = document.getElementById('login-form')
  const loginError = document.getElementById('login-error')
  const btnLogin = document.getElementById('btn-login')
  const btnDownload = document.getElementById('btn-download')
  const btnLogout = document.getElementById('btn-logout')
  const welcomeText = document.getElementById('welcome-text')
  const downloadProgress = document.getElementById('download-progress')
  const progressFill = document.getElementById('progress-fill')
  const progressText = document.getElementById('progress-text')

  // ============================================================================
  // Login
  // ============================================================================
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    loginError.textContent = ''

    const username = document.getElementById('username').value.trim()
    const password = document.getElementById('password').value

    if (!username || !password) {
      loginError.textContent = 'Introduce usuario y contraseña'
      return
    }

    btnLogin.disabled = true
    btnLogin.textContent = 'Accediendo...'

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error de autenticación')
      }

      // Login exitoso
      authToken = data.token
      userData = data.user
      showDownloadSection()
    } catch (err) {
      loginError.textContent = err.message || 'Error al conectar con el servidor'
    } finally {
      btnLogin.disabled = false
      btnLogin.textContent = 'Acceder'
    }
  })

  // ============================================================================
  // Mostrar sección de descarga
  // ============================================================================
  function showDownloadSection() {
    loginSection.classList.add('hidden')
    downloadSection.classList.remove('hidden')
    instructionsSection.classList.remove('hidden')
    welcomeText.textContent = userData.welcomeMessage || `Bienvenido ${userData.displayName}`
  }

  // ============================================================================
  // Logout
  // ============================================================================
  btnLogout.addEventListener('click', () => {
    authToken = null
    userData = null
    loginSection.classList.remove('hidden')
    downloadSection.classList.add('hidden')
    instructionsSection.classList.add('hidden')
    loginForm.reset()
    loginError.textContent = ''
  })

  // ============================================================================
  // Descarga
  // ============================================================================
  btnDownload.addEventListener('click', async () => {
    if (!authToken) {
      loginError.textContent = 'Sesión expirada. Inicia sesión de nuevo.'
      btnLogout.click()
      return
    }

    btnDownload.disabled = true
    downloadProgress.classList.remove('hidden')
    progressText.textContent = 'Obteniendo enlace de descarga...'
    progressFill.style.width = '10%'

    try {
      // 1. Obtener presigned URL y config del backend
      const response = await fetch(`${API_BASE}/download?token=${encodeURIComponent(authToken)}`, {
        method: 'GET'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener la descarga')
      }

      progressText.textContent = 'Preparando archivos...'
      progressFill.style.width = '50%'

      // 2. Descargar config.json (generado localmente desde los datos del backend)
      const configBlob = new Blob([JSON.stringify(data.config, null, 2)], {
        type: 'application/json'
      })
      downloadBlob(configBlob, 'config.json')

      // 3. Descargar el .exe abriendo la presigned URL directamente (sin fetch, sin CORS)
      progressText.textContent = 'Iniciando descarga del instalador...'
      progressFill.style.width = '80%'

      window.open(data.downloadUrl, '_blank')

      progressFill.style.width = '100%'
      progressText.textContent = 'Descarga iniciada. Revisa tu carpeta de descargas.'
    } catch (err) {
      progressText.textContent = `Error: ${err.message}`
      progressFill.style.width = '0%'

      // Si el token expiró, volver al login
      if (err.message.includes('expirado') || err.message.includes('inválido')) {
        setTimeout(() => btnLogout.click(), 2000)
      }
    } finally {
      btnDownload.disabled = false
    }
  })

  // ============================================================================
  // Utilidades
  // ============================================================================
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
})()
