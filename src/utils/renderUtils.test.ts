import { describe, expect, it } from 'vitest'
import {
  createSeededRandom,
  ellipsize,
  fitImageInBox,
  hashSeed,
} from './renderUtils'

/** 用固定字宽模拟 canvas 测量，避免依赖真实渲染环境 */
function stubContext(charWidth = 10): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({ width: text.length * charWidth }),
  } as unknown as CanvasRenderingContext2D
}

describe('hashSeed', () => {
  it('相同输入产生相同种子', () => {
    expect(hashSeed('a|b|c')).toBe(hashSeed('a|b|c'))
  })

  it('不同输入产生不同种子', () => {
    expect(hashSeed('a|b|c')).not.toBe(hashSeed('a|b|d'))
  })
})

describe('createSeededRandom', () => {
  it('相同种子生成相同序列（预览与导出一致）', () => {
    const first = createSeededRandom(42)
    const second = createSeededRandom(42)
    const seqA = Array.from({ length: 8 }, () => first())
    const seqB = Array.from({ length: 8 }, () => second())
    expect(seqA).toEqual(seqB)
  })

  it('不同种子生成不同序列', () => {
    const a = createSeededRandom(1)()
    const b = createSeededRandom(2)()
    expect(a).not.toBe(b)
  })

  it('输出始终落在 [0, 1)', () => {
    const random = createSeededRandom(7)
    for (let i = 0; i < 200; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('fitImageInBox', () => {
  it('contain 模式下完整保留图片并按短边留白', () => {
    const result = fitImageInBox(1000, 500, 400, 800, 'contain')
    expect(result.dest.dw).toBe(400)
    expect(result.dest.dh).toBe(200)
    expect(result.dest.dx).toBe(0)
    expect(result.dest.dy).toBe(300)
    expect(result.source).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 500 })
  })

  it('cover 模式下裁切填满内容框且不超出边界', () => {
    const result = fitImageInBox(1000, 500, 400, 800, 'cover')
    expect(result.dest.dw).toBe(400)
    expect(result.dest.dh).toBe(800)
    expect(result.source.sw).toBeLessThanOrEqual(1000)
    expect(result.source.sh).toBe(500)
    expect(result.source.sx).toBeGreaterThanOrEqual(0)
  })

  it('宽图 cover 到 3:4 时左右裁切居中', () => {
    const result = fitImageInBox(1200, 600, 300, 400, 'cover')
    expect(result.source.sh).toBe(600)
    expect(result.source.sw).toBe(450)
    expect(result.source.sx).toBe(375)
  })

  it('高图 cover 到 3:4 时上下裁切居中', () => {
    const result = fitImageInBox(600, 1200, 300, 400, 'cover')
    expect(result.source.sw).toBe(600)
    expect(result.source.sh).toBe(800)
    expect(result.source.sy).toBe(200)
  })
})

describe('ellipsize', () => {
  it('未超宽时原样返回', () => {
    const c = stubContext()
    expect(ellipsize(c, 'abc', 100)).toBe('abc')
  })

  it('超宽时截断并追加省略号', () => {
    const c = stubContext(10)
    const result = ellipsize(c, 'abcdefghij', 45)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThan('abcdefghij'.length)
  })

  it('空字符串返回空', () => {
    const c = stubContext()
    expect(ellipsize(c, '', 100)).toBe('')
  })
})
