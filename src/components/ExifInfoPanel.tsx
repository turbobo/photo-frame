import type { PhotoData } from '../types'

interface Props { photo: PhotoData | null }

export default function ExifInfoPanel({ photo }: Props) {
  if (!photo) {
    return <div className="p-4 text-[12px] text-slate-500">先上传一张照片</div>
  }
  const { exif, file, image } = photo

  const rows: Array<[string, string | undefined]> = [
    ['文件', file.name],
    ['尺寸', `${image.naturalWidth} × ${image.naturalHeight}`],
    ['大小', `${(file.size / 1024 / 1024).toFixed(2)} MB`],
    ['相机', [exif.make, exif.model].filter(Boolean).join(' ') || undefined],
    ['镜头', exif.lens],
    ['焦距', exif.focalLength ? `${Math.round(exif.focalLength)} mm` : undefined],
    ['光圈', exif.fNumber ? `f/${exif.fNumber}` : undefined],
    ['快门', exif.exposureTime],
    ['ISO',  exif.iso ? `ISO ${exif.iso}` : undefined],
    ['时间', exif.dateTaken],
    ['GPS',  exif.gps ? `${exif.gps.lat.toFixed(4)}, ${exif.gps.lng.toFixed(4)}` : undefined],
  ]

  return (
    <div className="p-4 fade-in">
      <div className="space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 text-[12px] leading-relaxed">
            <span className="text-slate-500 shrink-0 w-12">{k}</span>
            <span className="text-slate-200 text-right break-all">{v || <span className="text-slate-600">—</span>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
