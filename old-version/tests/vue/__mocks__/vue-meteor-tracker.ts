/**
 * Mock for vue-meteor-tracker.
 * useTracker runs the reactive function once and returns its result as a ref.
 */
import { ref } from 'vue'

export function useTracker(fn: () => any) {
  const result = fn()
  return ref(result)
}
