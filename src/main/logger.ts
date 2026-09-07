/**
 * logger.ts
 *
 * File logging for the main process.
 *
 * The packaged app has no visible console, which makes diagnosing printing
 * problems (or any main-process issue) impossible from a user's machine.
 * This module mirrors every console.log/info/warn/error call to a rotating
 * log file inside the app's userData folder, so a log can be inspected or
 * sent for support.
 *
 * Log location:
 *   %APPDATA%\stamp-sales-app\logs\main.log        (current)
 *   %APPDATA%\stamp-sales-app\logs\main.prev.log   (previous run / rotated)
 *
 * Console output is preserved, so `npm run dev` behaves as before.
 */

import { app } from 'electron'
import { join } from 'path'
import {
  existsSync,
  mkdirSync,
  createWriteStream,
  statSync,
  renameSync,
  type WriteStream
} from 'fs'

/** Rotate the log once it grows past this size (5 MB). */
const MAX_LOG_BYTES = 5 * 1024 * 1024

let stream: WriteStream | null = null
let logFilePath = ''
let installed = false

/** Returns the absolute path of the current log file (empty if not initialised). */
export function getLogFilePath(): string {
  return logFilePath
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ''}`
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function timestamp(): string {
  return new Date().toISOString()
}

/**
 * Initialises file logging and patches the console methods so all existing
 * console.* calls in the main process are also written to disk.
 *
 * Safe to call once at startup; subsequent calls are ignored.
 * Never throws — logging must not break the app.
 */
export function initFileLogger(): void {
  if (installed) return
  installed = true

  try {
    const logsDir = join(app.getPath('userData'), 'logs')
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }

    logFilePath = join(logsDir, 'main.log')

    // Rotate if the current log is too big
    try {
      if (existsSync(logFilePath) && statSync(logFilePath).size > MAX_LOG_BYTES) {
        renameSync(logFilePath, join(logsDir, 'main.prev.log'))
      }
    } catch {
      /* rotation is best-effort */
    }

    stream = createWriteStream(logFilePath, { flags: 'a' })
    stream.on('error', () => {
      // Disable file logging on stream failure; console still works.
      stream = null
    })

    const write = (level: string, args: unknown[]): void => {
      if (!stream) return
      try {
        stream.write(`[${timestamp()}] [${level}] ${args.map(formatArg).join(' ')}\n`)
      } catch {
        /* ignore */
      }
    }

    const original = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    }

    console.log = (...args: unknown[]): void => {
      original.log(...args)
      write('INFO', args)
    }
    console.info = (...args: unknown[]): void => {
      original.info(...args)
      write('INFO', args)
    }
    console.warn = (...args: unknown[]): void => {
      original.warn(...args)
      write('WARN', args)
    }
    console.error = (...args: unknown[]): void => {
      original.error(...args)
      write('ERROR', args)
    }

    // Capture crashes that would otherwise vanish silently
    process.on('uncaughtException', (err) => {
      write('FATAL', ['uncaughtException:', err])
    })
    process.on('unhandledRejection', (reason) => {
      write('FATAL', ['unhandledRejection:', reason])
    })

    console.log(
      `[Logger] File logging started — version=${app.getVersion()} packaged=${app.isPackaged} log=${logFilePath}`
    )
  } catch {
    // If logging can't be set up, continue without it.
    stream = null
  }
}
