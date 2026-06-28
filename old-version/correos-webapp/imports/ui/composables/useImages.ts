import { ref, onUnmounted } from 'vue'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Images } from '../../api/images/collection'

export interface UseImages {
  modelo1: import('vue').Ref<string | null>
  modelo2: import('vue').Ref<string | null>
  uploadImage(dataUri: string, name: string): Promise<void>
}

/**
 * Composable for managing stamp model images (Modelo1 / Modelo2).
 * Uses Meteor's Tracker.autorun directly for reactivity.
 *
 * Images are stored as base64 data URIs directly in MongoDB.
 */
export function useImages(): UseImages {
  const modelo1 = ref<string | null>(null)
  const modelo2 = ref<string | null>(null)

  // Subscribe and reactively track image documents
  const computation = Tracker.autorun(() => {
    const handle = Meteor.subscribe('images')
    if (!handle.ready()) return

    const img1 = Images.findOne({ name: 'Modelo1' }) as { url?: string } | undefined
    const img2 = Images.findOne({ name: 'Modelo2' }) as { url?: string } | undefined

    modelo1.value = img1?.url ?? null
    modelo2.value = img2?.url ?? null
  })

  onUnmounted(() => {
    computation.stop()
  })

  /**
   * Upload an image (as data URI from a crop dialog) to the images collection.
   */
  async function uploadImage(dataUri: string, name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      Meteor.call(
        'uploadImageBase64',
        name,
        dataUri,
        'image/png',
        dataUri.length,
        (error: Error | null) => {
          if (error) reject(error)
          else resolve()
        }
      )
    })
  }

  return {
    modelo1,
    modelo2,
    uploadImage,
  }
}
