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
  | 'vintage-photo' | 'text-embed' | 'tiled-watermark'

export type FontFamily = 'noto-serif' | 'noto-sans' | 'inter' | 'jetbrains' | 'wenkai'

/** 9 宫格定位（0-8，左上到右下） */
export type GridPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

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
  // 老照片时间戳（vintage-photo）
  timestampColor?: string      // 数码管颜色（默认 #ff3d00 橙红）
  timestampPosition?: GridPosition // 9 宫格位置（默认 8 = bottom-right）
  // 文字内嵌（text-embed）
  embedLayout?: 'v' | 'h'            // 垂直/水平布局
  embedPosition?: GridPosition       // 9 宫格位置（默认 7 = bottom-left）
  embedOpacity?: number              // 0-1（默认 0.55）
  // 平铺水印（tiled-watermark）
  watermarkText?: string     // 水印文本（默认 customText 或 "Photo Frame"）
  watermarkAngle?: number    // 旋转角度 -45~45 度（默认 -22）
  watermarkDensity?: number  // 密度 0.5~3（默认 1，越大越密）
  watermarkOpacity?: number  // 0-1（默认 0.18）
}

export interface PhotoData {
  file: File
  image: HTMLImageElement
  exif: ExifData
  originalName: string
}
