declare module 'react-easy-crop' {
  import { Component } from 'react'

  export type Point = {
    x: number
    y: number
  }

  export type Area = {
    width: number
    height: number
    x: number
    y: number
  }

  export interface CropperProps {
    image?: string
    video?: string
    crop: Point
    zoom?: number
    rotation?: number
    aspect?: number
    minZoom?: number
    maxZoom?: number
    cropShape?: 'rect' | 'round'
    showGrid?: boolean
    zoomSpeed?: number
    zoomWithScroll?: boolean
    onCropChange: (location: Point) => void
    onZoomChange?: (zoom: number) => void
    onRotationChange?: (rotation: number) => void
    onCropComplete?: (croppedArea: Area, croppedAreaPixels: Area) => void
    onMediaLoaded?: (mediaSize: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => void
    classes?: { containerClassName?: string; mediaClassName?: string; cropAreaClassName?: string }
    style?: { containerStyle?: React.CSSProperties; mediaStyle?: React.CSSProperties; cropAreaStyle?: React.CSSProperties }
  }

  export default class Cropper extends Component<CropperProps> {}
}
