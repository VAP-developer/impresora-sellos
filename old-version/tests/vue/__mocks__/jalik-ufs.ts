/**
 * Mock for meteor/jalik:ufs (UploadFS).
 */
import { vi } from 'vitest'

export const UploadFS = {
  Uploader: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
  })),
}
