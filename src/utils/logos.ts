// 相机品牌 Logo 匹配 + SVG 加载

const LOGO_MAP: Record<string, string> = {
  sony:      '/logos/sony.svg',
  canon:     '/logos/canon.svg',
  nikon:     '/logos/nikon.svg',
  fujifilm:  '/logos/fujifilm.svg',
  panasonic: '/logos/panasonic.svg',
  olympus:   '/logos/olympus.svg',
  leica:     '/logos/leica.svg',
  pentax:    '/logos/pentax.svg',
  hasselblad:'/logos/hasselblad.svg',
  ricoh:     '/logos/ricoh.svg',
  apple:     '/logos/apple.svg',
  huawei:    '/logos/huawei.svg',
  xiaomi:    '/logos/xiaomi.svg',
  dji:       '/logos/dji.svg',
}

export function getLogoPath(make?: string): string | null {
  if (!make) return null
  const key = make.toLowerCase().replace(/\s+/g, '').replace(/imaging|corporation|corp\.?|inc\.?|ltd\.?/gi, '').trim()
  for (const brand of Object.keys(LOGO_MAP)) {
    if (key.includes(brand)) return LOGO_MAP[brand]
  }
  return null
}

const logoCache = new Map<string, HTMLImageElement>()

export async function loadLogo(path: string): Promise<HTMLImageElement> {
  if (logoCache.has(path)) return logoCache.get(path)!
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { logoCache.set(path, img); resolve(img) }
    img.onerror = () => reject(new Error(`Logo 加载失败: ${path}`))
    img.src = path
  })
}
