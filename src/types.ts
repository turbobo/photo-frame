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

export type TemplateId =
  | 'minimal' | 'polaroid' | 'film' | 'exif' | 'insta'
  | 'leica' | 'red-dot' | 'dazz' | 'instax' | 'xhs' | 'vintage' | 'magazine' | 'location'
  | 'light-shadow'
  | 'frameless-rounded' | 'white-border' | 'ps-splash' | 'lr-splash'

export type FontFamily = 'noto-serif' | 'noto-sans' | 'inter' | 'jetbrains' | 'wenkai'

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
  fontFamily?: FontFamily
  locationName?: string // 用于 location 模板的地点名
  // 扩展字段（仅部分模板使用）
  borderPadding?: number // 相框边距（白色边框模板），相对图片长边 %
  imageRadius?: number   // 图片自身圆角（无框圆角 / PS/LR 启动窗）
  imageShadow?: boolean  // 图片阴影（无框圆角）
  copyright?: string     // 版权信息（PS/LR 启动窗）
  website?: string       // 网站文本（PS/LR 启动窗）
  isAcrylic?: boolean    // 亚克力毛玻璃效果（PS 启动窗）
}

export interface PhotoData {
  file: File
  image: HTMLImageElement
  exif: ExifData
  originalName: string
}
