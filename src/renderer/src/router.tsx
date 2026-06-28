import { createHashRouter, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import { HomeView, KioskoView, MaquinaView, ImprimirView, SubirImagenView } from './views'

export const router = createHashRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/home" replace />
      },
      {
        path: 'home',
        element: <HomeView />
      },
      {
        path: 'kiosko',
        element: <KioskoView />
      },
      {
        path: 'maquina',
        element: <MaquinaView />
      },
      {
        path: 'imprimir',
        element: <ImprimirView />
      },
      {
        path: 'subir-imagen',
        element: <SubirImagenView />
      }
    ]
  }
])
