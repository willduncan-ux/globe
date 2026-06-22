import { useState } from 'react'
import { Camera, Check, Loader2 } from 'lucide-react'

/**
 * One-tap capture of the current globe view with a subtle title + timestamp
 * watermark — the talkability bridge. Shares via the Web Share API where
 * available (mobile), otherwise downloads a PNG.
 *
 * Reads the WebGL canvas directly (the globe renders with preserveDrawingBuffer
 * on), so the planets, terminator and flights are all in the shot; the chrome
 * is intentionally left out for a clean image.
 */
async function captureGlobe(): Promise<Blob | null> {
  const src = document.querySelector('canvas')
  if (!src) return null
  await document.fonts.ready

  const w = src.width
  const h = src.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(src, 0, 0)

  // Gradient scrim along the bottom so the watermark stays legible.
  const grad = ctx.createLinearGradient(0, h * 0.72, 0, h)
  grad.addColorStop(0, 'rgba(7,10,18,0)')
  grad.addColorStop(1, 'rgba(7,10,18,0.62)')
  ctx.fillStyle = grad
  ctx.fillRect(0, Math.round(h * 0.72), w, Math.ceil(h * 0.28))

  const s = w / 1000
  const pad = Math.round(42 * s)
  const now = new Date()
  const time = now.toISOString().slice(11, 19)
  const date = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#E9EEF8'
  ctx.font = `600 ${Math.round(34 * s)}px "Space Grotesk", system-ui, sans-serif`
  ctx.fillText('Right Now on Earth', pad, h - pad - Math.round(26 * s))
  ctx.fillStyle = 'rgba(143,151,168,0.95)'
  ctx.font = `${Math.round(19 * s)}px "JetBrains Mono", ui-monospace, monospace`
  ctx.fillText(`${time} UTC · ${date}`, pad, h - pad)

  return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
}

export function CaptureButton() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')

  const onClick = async () => {
    if (state === 'busy') return
    setState('busy')
    try {
      const blob = await captureGlobe()
      if (!blob) {
        setState('idle')
        return
      }
      const file = new File([blob], `right-now-on-earth-${Date.now()}.png`, {
        type: 'image/png',
      })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator
          .share({ files: [file], title: 'Right Now on Earth' })
          .catch(() => {})
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setState('done')
      setTimeout(() => setState('idle'), 1800)
    } catch {
      setState('idle')
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Capture and share this view"
      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-abyss/60 text-frost shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-colors hover:bg-abyss/80 disabled:opacity-70"
      disabled={state === 'busy'}
    >
      {state === 'busy' ? (
        <Loader2 size={18} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden />
      ) : state === 'done' ? (
        <Check size={18} strokeWidth={2.25} style={{ color: '#FF9E5A' }} aria-hidden />
      ) : (
        <Camera size={18} strokeWidth={1.9} aria-hidden />
      )}
    </button>
  )
}
