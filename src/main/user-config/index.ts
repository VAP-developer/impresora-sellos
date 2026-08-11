/**
 * User Config Module
 *
 * Reads the config.json file that comes with the user's download.
 * This file is user-specific and contains personalized configuration
 * (welcome message, user identity, license info in the future, etc.).
 *
 * Search order (packaged mode):
 * 1. userData (AppData/Roaming/stamp-sales-app/) — persistent location
 * 2. Next to the executable (installation folder)
 * 3. User's Downloads folder (where the browser saves it)
 * 4. resources/ folder (packaged with the app)
 *
 * If found in Downloads or next to exe, it gets COPIED to userData
 * so it persists across updates and doesn't need to be placed manually.
 */

import { app } from 'electron'
import { dirname, join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

// ============================================================================
// Types
// ============================================================================

export interface UserConfig {
  version: number
  user: {
    id: string
    username: string
    displayName: string
  }
  app: {
    welcomeMessage: string
  }
  license: Record<string, unknown>
  database: Record<string, unknown>
}

// ============================================================================
// Default (when no config.json exists)
// ============================================================================

const DEFAULT_USER_CONFIG: UserConfig = {
  version: 1,
  user: {
    id: 'local',
    username: 'local',
    displayName: 'Usuario'
  },
  app: {
    welcomeMessage: 'Bienvenido'
  },
  license: {},
  database: {}
}

// ============================================================================
// State
// ============================================================================

let userConfig: UserConfig = { ...DEFAULT_USER_CONFIG }

// ============================================================================
// Public API
// ============================================================================

/**
 * Loads the config.json file from the expected location.
 * Call this during app initialization (after app.whenReady()).
 * If the file doesn't exist, uses default config silently.
 */
export function loadUserConfig(): UserConfig {
  const { path: configPath, shouldCopy } = findConfigPath()

  if (!configPath) {
    console.log('[user-config] No config.json found. Using default configuration.')
    userConfig = { ...DEFAULT_USER_CONFIG }
    return userConfig
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<UserConfig>

    // Merge with defaults to ensure all fields exist
    userConfig = {
      version: parsed.version ?? DEFAULT_USER_CONFIG.version,
      user: {
        ...DEFAULT_USER_CONFIG.user,
        ...parsed.user
      },
      app: {
        ...DEFAULT_USER_CONFIG.app,
        ...parsed.app
      },
      license: parsed.license ?? {},
      database: parsed.database ?? {}
    }

    console.log(`[user-config] Loaded config.json from: ${configPath}`)
    console.log(`[user-config] User: ${userConfig.user.displayName} (${userConfig.user.username})`)

    // If found outside of userData, copy it there for persistence
    if (shouldCopy && app.isPackaged) {
      copyToUserData(raw)
    }

    return userConfig
  } catch (err) {
    console.error('[user-config] Failed to parse config.json:', err)
    userConfig = { ...DEFAULT_USER_CONFIG }
    return userConfig
  }
}

/**
 * Returns the currently loaded user config.
 * Must be called after loadUserConfig().
 */
export function getUserConfig(): UserConfig {
  return userConfig
}

// ============================================================================
// Internal
// ============================================================================

interface FindResult {
  path: string | null
  shouldCopy: boolean
}

function findConfigPath(): FindResult {
  if (app.isPackaged) {
    const userDataPath = join(app.getPath('userData'), 'config.json')
    
    // Buscar en ubicaciones externas (Downloads, exe folder, etc.)
    const externalPath = findExternalConfig()

    if (externalPath && existsSync(userDataPath)) {
      // Si hay uno externo Y uno en userData, usar el externo si es más reciente
      const { statSync } = require('fs')
      try {
        const externalMtime = statSync(externalPath).mtimeMs
        const userDataMtime = statSync(userDataPath).mtimeMs
        if (externalMtime > userDataMtime) {
          // El externo es más nuevo → usarlo y actualizar userData
          return { path: externalPath, shouldCopy: true }
        }
      } catch {
        // Si falla la comparación, usar el externo por seguridad
        return { path: externalPath, shouldCopy: true }
      }
      // userData es más reciente o igual, usarlo
      return { path: userDataPath, shouldCopy: false }
    }

    if (externalPath) {
      // No hay nada en userData, usar el externo
      return { path: externalPath, shouldCopy: true }
    }

    if (existsSync(userDataPath)) {
      // Solo hay en userData
      return { path: userDataPath, shouldCopy: false }
    }
  } else {
    // Dev mode: project root
    const devPath = join(app.getAppPath(), 'config.json')
    if (existsSync(devPath)) {
      return { path: devPath, shouldCopy: false }
    }
  }

  return { path: null, shouldCopy: false }
}

/**
 * Busca config.json en ubicaciones externas (fuera de userData).
 */
function findExternalConfig(): string | null {
  const candidates: string[] = []

  // Next to the executable
  candidates.push(join(dirname(app.getPath('exe')), 'config.json'))

  // Downloads folder
  try {
    candidates.push(join(app.getPath('downloads'), 'config.json'))
  } catch { /* ignore */ }

  // Desktop
  try {
    candidates.push(join(app.getPath('desktop'), 'config.json'))
  } catch { /* ignore */ }

  // Resources
  candidates.push(join(process.resourcesPath, 'config.json'))

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * Copies config.json content to the userData directory for persistence.
 * This way the user only needs to have the file in Downloads once;
 * after the first launch it lives in AppData permanently.
 */
function copyToUserData(content: string): void {
  try {
    const userDataDir = app.getPath('userData')
    if (!existsSync(userDataDir)) {
      mkdirSync(userDataDir, { recursive: true })
    }
    const destPath = join(userDataDir, 'config.json')
    writeFileSync(destPath, content, 'utf-8')
    console.log(`[user-config] Copied config.json to userData: ${destPath}`)
  } catch (err) {
    console.error('[user-config] Failed to copy config.json to userData:', err)
  }
}
