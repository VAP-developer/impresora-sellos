/**
 * Mock for the Meteor global object.
 * Provides subscribe and call stubs used by composables.
 */
import { vi } from 'vitest'

export const Meteor = {
  subscribe: vi.fn(() => ({ ready: () => true })),
  call: vi.fn((...args: any[]) => {
    // The last argument is always the callback
    const callback = args[args.length - 1]
    if (typeof callback === 'function') {
      callback(null, undefined)
    }
  }),
}
