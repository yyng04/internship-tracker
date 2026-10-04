import { useEffect, useRef, useState } from 'react'
import type { Application, Profile } from '../../types'
import { LetterPage } from './LetterPage'

// A4 in CSS pixels: 210mm by 297mm at 96 pixels per inch.
const PAGE_W = 793.7
const PAGE_H = 1122.5

/** The letter page scaled to the width of its container, with a mark where page one ends. */
export function LetterPreview(props: { body: string; profile: Profile; application?: Application }) {
  const wrap = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  const [contentH, setContentH] = useState(PAGE_H)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_W)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = page.current
    if (!el) return
    const observer = new ResizeObserver(() => setContentH(el.scrollHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const overflow = contentH > PAGE_H + 1
  return (
    <div ref={wrap}>
      {overflow && (
        <p className="mb-2 text-xs text-amber-300">
          The letter runs onto a second page. The dashed line marks the end of page one.
        </p>
      )}
      <div className="relative overflow-hidden rounded shadow" style={{ height: Math.max(PAGE_H, contentH) * scale }}>
        <div style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <LetterPage ref={page} {...props} />
        </div>
        {overflow && (
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-amber-500"
            style={{ top: PAGE_H * scale }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}
