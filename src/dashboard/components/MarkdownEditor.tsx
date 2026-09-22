import { useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import { cx } from '../../lib/utils'
import { Button, Card, Textarea } from './ui'

// Manual "prose" styling so the preview matches the rest of the dashboard
// without pulling in the typography plugin.
export const PREVIEW_CLS =
  'space-y-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 ' +
  '[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold ' +
  '[&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 ' +
  '[&_strong]:font-semibold [&_em]:italic'

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minRows = 20,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  minRows?: number
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const wrapRef = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMarkdown(value), [value])

  // Grow the textarea with its content instead of scrolling inside it.
  useEffect(() => {
    // The Textarea primitive does not forward refs, so find it via the wrapper.
    const el = wrapRef.current?.querySelector('textarea')
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, mode])

  return (
    <div>
      <div className="mb-2 flex gap-1 lg:hidden">
        <Button size="sm" variant={mode === 'edit' ? 'primary' : 'ghost'} onClick={() => setMode('edit')}>
          Edit
        </Button>
        <Button size="sm" variant={mode === 'preview' ? 'primary' : 'ghost'} onClick={() => setMode('preview')}>
          Preview
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div ref={wrapRef} className={cx(mode === 'edit' ? 'block' : 'hidden', 'lg:block')}>
          <Textarea
            rows={minRows}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="resize-none overflow-hidden font-mono text-xs leading-relaxed"
          />
        </div>
        <Card className={cx(mode === 'preview' ? 'block' : 'hidden', 'lg:block', 'overflow-x-auto')}>
          {value.trim() ? (
            <div className={PREVIEW_CLS} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-sm text-zinc-400">Preview appears here as you type.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
