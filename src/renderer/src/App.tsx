import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useConfigStore } from '@renderer/stores/config.store'
import { usePrinterStore } from '@renderer/stores/printer.store'
import { router } from './router'

function App(): JSX.Element {
  const loadConfig = useConfigStore((s) => s.loadConfig)
  const fetchStatus = usePrinterStore((s) => s.fetchStatus)
  const config = useConfigStore((s) => s.config)
  const loading = useConfigStore((s) => s.loading)
  const error = useConfigStore((s) => s.error)

  useEffect(() => {
    loadConfig()
    fetchStatus()
  }, [loadConfig, fetchStatus])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-500">Cargando configuración...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-2">Error al cargar la aplicación</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-500">Inicializando...</p>
      </div>
    )
  }

  return <RouterProvider router={router} />
}

export default App
