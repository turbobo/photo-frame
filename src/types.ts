export interface ExifData {
  make?: string
  model?: string
  lens?: string
  fNumber?: number
  exposureTime?: string
  iso?: number
  focalLength?: number
  dateTaken?: string
  gps?: { lat: number; lng: number }
  width?: number
  height?: number
}

export type TemplateId = 'minimal' | 'polaroid' | 'film' | 'exif' | 'insta'

export interface TemplateConfig {
  id: TemplateId
  padding: number      // 0-30 (%)
  bgColor: string
  textColor: string
  showLogo: boolean
  showExif: boolean
  customText: string
  fontSize: number     // 相对图片长边的百分比 (1-5)
  logoSize: number     // 相对图片长边的百分比 (2-10)
  radius: number       // 0-50 px
  shadow: boolean
}

export interface PhotoData {
  file: File
  image: HTMLImageElement
  exif: ExifData
  originalName: string
}
