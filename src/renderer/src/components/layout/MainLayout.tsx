import { Outlet } from 'react-router-dom'
import NavComponent from './NavComponent'

/**
 * MainLayout wraps all views with the common application structure:
 * - Navigation bar at the top (NavComponent)
 * - Main content area rendering the active route via Outlet
 *
 * Replicates the legacy App.vue structure: NavComponent + router-view
 */
export default function MainLayout(): JSX.Element {
  return (
    <div id="app-root" className="min-h-screen bg-gray-50 flex flex-col">
      <NavComponent />

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
