import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { cx } from '../../lib/utils'

const MAX_BYTES = 10 * 1024 * 1024

interface FileDropProps {
  accept?: string
  onFile: (file: File) => void
  label?: string
}

/** Dashed drop zone. Drag a file onto it or click to browse. Rejects files over 10 MB. */
export function FileDrop({ accept, onFile, label = 'Drop a file here or click to browse' }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handle(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`)
      return
    }
    setError(null)
    onFile(file)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handle(e.dataTransfer.files?.[0])
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    handle(e.target.files?.[0])
    // Reset so picking the same file again still fires onChange.
    e.target.value = ''
  }

  const hint = accept?.toLowerCase().includes('pdf') ? 'PDF up to 10 MB' : 'Up to 10 MB'

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition',
          dragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
            : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800',
        )}
      >
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
        <input ref={inputRef} type="file" accept={accept} onChange={onChange} className="hidden" />
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
