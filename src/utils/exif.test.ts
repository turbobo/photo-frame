import { describe, expect, it } from 'vitest'
import { validateDecodedImageDimensions, validateImageFile } from './exif'

describe('validateDecodedImageDimensions', () => {
  it('接受常见高分辨率照片', () => {
    expect(() => validateDecodedImageDimensions(6000, 4000)).not.toThrow()
  })

  it('拒绝超过最大边长的照片', () => {
    expect(() => validateDecodedImageDimensions(12_001, 1000)).toThrow('图片边长不能超过')
  })

  it('拒绝超过最大像素数的照片', () => {
    expect(() => validateDecodedImageDimensions(10_000, 7000)).toThrow('图片像素过高')
  })

  it('拒绝无效尺寸', () => {
    expect(() => validateDecodedImageDimensions(0, 1000)).toThrow('无法读取图片尺寸')
  })
})

describe('validateImageFile', () => {
  it('拒绝不支持的扩展名', () => {
    const file = new File(['content'], 'photo.txt', { type: 'text/plain' })
    expect(() => validateImageFile(file)).toThrow('不支持的图像格式')
  })
})
