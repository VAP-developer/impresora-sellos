import { useState, useEffect } from 'react'

/**
 * Custom hook that tracks the browser's online/offline status.
 * Uses navigator.onLine for initial value and listens to window events.
 */
export function useOnlineStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    function handleOnline(): void {
      setIsOnline(true)
    }

    function handleOffline(): void {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
