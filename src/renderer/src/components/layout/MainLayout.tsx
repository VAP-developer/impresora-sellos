import { Outlet } from 'react-router-dom'
import NavComponent from './NavComponent'
import { useVirtualKeyboard } from '@renderer/components/virtual-keyboard/VirtualKeyboardContext'

/**
 * MainLayout wraps all views with the common application structure:
 * - Navigation bar at the top (NavComponent)
 * - Main content area rendering the active route via Outlet
 *
 * When the virtual keyboard is visible, the container adds bottom padding
 * so the flex-1 main area shrinks, keeping content above the keyboard without
 * requiring manual scroll.
 */
export default function MainLayout(): JSX.Element {
  const { isVisible, keyboardType } = useVirtualKeyboard()

  const keyboardPadding = isVisible
    ? keyboardType === 'full'
      ? 'pb-[280px]'
      : keyboardType === 'numeric'
        ? 'pb-[220px]'
        : ''
    : ''

  return (
    <div
      id="app-root"
      className={`h-screen bg-gray-50 flex flex-col ${keyboardPadding}`}
    >
      <NavComponent />

      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
