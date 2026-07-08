import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  rendered: HTMLCanvasElement
  onClose: () => void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 30

export default function FullscreenPreview({ rendered, onClose }: Props) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const gestureRef = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    pinchDist: 0,
    pinchMid: { x: 0, y: 0 },
    zoomStart: 1,
    offsetStart: { x: 0, y: 0 },
    lastTapTime: 0,
    lastTapPos: { x: 0, y: 0 },
    didMove: false,
  })

  const fitSize = useMemo(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const ratio = Math.min(vw / rendered.width, vh / rendered.height)
    return { w: Math.round(rendered.width * ratio), h: Math.round(rendered.height * ratio) }
  }, [rendered])

  const [fitW, setFitW] = useState(fitSize.w)
  const [fitH, setFitH] = useState(fitSize.h)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    const onResize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const ratio = Math.min(vw / rendered.width, vh / rendered.height)
      setFitW(Math.round(rendered.width * ratio))
      setFitH(Math.round(rendered.height * ratio))
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [rendered])

  const handleClose = useCallback(() => {
    setVisible(false)
    fadeTimerRef.current = setTimeout(onClose, 150)
  }, [onClose])

  useEffect(() => () => clearTimeout(fadeTimerRef.current), [])

  const clampOffset = useCallback((ox: number, oy: number, z: number) => {
    if (z <= 1) return { x: 0, y: 0 }
    const maxX = Math.max(0, (fitW * z - window.innerWidth) / 2 / z)
    const maxY = Math.max(0, (fitH * z - window.innerHeight) / 2 / z)
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    }
  }, [fitW, fitH])

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const g = gestureRef.current
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    g.didMove = false

    if (g.pointers.size === 2) {
      const [a, b] = Array.from(g.pointers.values())
      g.pinchDist = dist(a, b)
      g.pinchMid = mid(a, b)
      g.zoomStart = zoom
      g.offsetStart = { ...offset }
    }
  }, [zoom, offset])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current
    const prev = g.pointers.get(e.pointerId)
    if (!prev) return

    const curr = { x: e.clientX, y: e.clientY }
    if (dist(prev, curr) > 3) g.didMove = true
    g.pointers.set(e.pointerId, curr)

    if (g.pointers.size === 2) {
      const [a, b] = Array.from(g.pointers.values())
      const newDist = dist(a, b)
      const scaleDelta = newDist / g.pinchDist
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.zoomStart * scaleDelta))

      const newMid = mid(a, b)
      const vcx = window.innerWidth / 2
      const vcy = window.innerHeight / 2

      const localX = (g.pinchMid.x - vcx) / g.zoomStart - g.offsetStart.x
      const localY = (g.pinchMid.y - vcy) / g.zoomStart - g.offsetStart.y

      const panDx = (newMid.x - g.pinchMid.x) / newZoom
      const panDy = (newMid.y - g.pinchMid.y) / newZoom

      const newOx = (g.pinchMid.x - vcx) / newZoom - localX + panDx
      const newOy = (g.pinchMid.y - vcy) / newZoom - localY + panDy

      const clamped = clampOffset(newOx, newOy, newZoom)
      setZoom(newZoom)
      setOffset(clamped)
    } else if (g.pointers.size === 1 && zoom > 1) {
      const dx = (curr.x - prev.x) / zoom
      const dy = (curr.y - prev.y) / zoom
      setOffset(o => clampOffset(o.x + dx, o.y + dy, zoom))
    }
  }, [zoom, clampOffset])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current
    g.pointers.delete(e.pointerId)

    if (g.pointers.size === 0 && !g.didMove) {
      const now = Date.now()
      const tapPos = { x: e.clientX, y: e.clientY }
      const gap = now - g.lastTapTime
      const tapDist = dist(tapPos, g.lastTapPos)

      if (gap < DOUBLE_TAP_MS && tapDist < DOUBLE_TAP_PX) {
        g.lastTapTime = 0
        if (zoom >= 1.5) {
          setZoom(1)
          setOffset({ x: 0, y: 0 })
        } else {
          const newZ = 2
          const vcx = window.innerWidth / 2
          const vcy = window.innerHeight / 2
          const ox = (tapPos.x - vcx) / zoom - (tapPos.x - vcx) / newZ
          const oy = (tapPos.y - vcy) / zoom - (tapPos.y - vcy) / newZ
          setZoom(newZ)
          setOffset(clampOffset(ox, oy, newZ))
        }
      } else {
        g.lastTapTime = now
        g.lastTapPos = tapPos
        if (zoom <= 1.05) {
          handleClose()
        }
      }
    }

    if (g.pointers.size === 1) {
      const [remaining] = Array.from(g.pointers.entries())
      g.pointers.set(remaining[0], remaining[1])
      g.didMove = false
    }
  }, [zoom, clampOffset, handleClose])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.92)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms cubic-bezier(0.2, 0, 0, 1)',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full
          bg-white/10 backdrop-blur-sm flex items-center justify-center
          text-white/80 active:bg-white/20 transition-colors duration-fast"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); handleClose() }}
        aria-label="关闭预览"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Zoom indicator */}
      {zoom > 1.05 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10
          bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full
          text-white/80 text-[11px] font-mono pointer-events-none">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Zoomable image */}
      <div
        style={{
          width: fitW,
          height: fitH,
          transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`,
          transformOrigin: 'center center',
          willChange: 'transform',
          boxShadow: zoom <= 1.05
            ? '0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)'
            : 'none',
          borderRadius: zoom <= 1.05 ? 4 : 0,
        }}
      >
        <FullscreenCanvas source={rendered} width={fitW} height={fitH} />
      </div>
    </div>,
    document.body,
  )
}

function FullscreenCanvas({ source, width, height }: {
  source: HTMLCanvasElement; width: number; height: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = width * dpr
    c.height = height * dpr
    c.style.width = `${width}px`
    c.style.height = `${height}px`
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, c.width, c.height)
  }, [source, width, height])
  return <canvas ref={ref} className="block" />
}
