/**
 * SubirImagenView.tsx
 *
 * Vista informativa: la gestión de imágenes ahora se realiza exclusivamente
 * mediante la sincronización con la nube desde Configuración.
 */

import { useNavigate } from 'react-router-dom'

export default function SubirImagenView(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div>
          <h1 className="text-black text-[25px] font-bold">Imágenes</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de imágenes de fondo para sellos
          </p>
        </div>
        <button
          type="button"
          className="bg-gray-400 text-white px-4 py-2 rounded font-semibold hover:bg-gray-500"
          onClick={() => navigate('/maquina')}
        >
          Volver
        </button>
      </div>

      <div className="flex justify-center mt-8">
        <div className="w-full max-w-lg px-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <svg
              className="h-12 w-12 text-blue-500 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.32-2.475A3.75 3.75 0 0118 15.75H6.75z"
              />
            </svg>
            <h2 className="text-lg font-bold text-blue-800 mb-2">
              Imágenes gestionadas desde la nube
            </h2>
            <p className="text-sm text-blue-700 mb-4">
              Las imágenes de fondos y sellos se gestionan de forma centralizada.
              Para actualizar la base de datos de imágenes, ve a{' '}
              <strong>Configuración</strong> y pulsa{' '}
              <strong>&quot;Sincronizar con la nube&quot;</strong>.
            </p>
            <button
              type="button"
              className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
              onClick={() => navigate('/settings')}
            >
              Ir a Configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
