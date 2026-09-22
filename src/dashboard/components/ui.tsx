import { useEffect, type ReactNode } from 'react'
import { cx } from '../../lib/utils'
import { STATUS_LABELS, type Status } from '../../types'

// Shared primitives. Keep styling here so a later design pass can restyle
// every page from one file.

export const STATUS_COLORS: Record<Status, string> = {
  wishlist: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  oa: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100',
  interview: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  offer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  withdrawn: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1 rounded font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-3 py-1.5 text-sm' }
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
  }
  return <button className={cx(base, sizes[size], variants[variant], className)} {...rest} />
}

const fieldCls =
  'w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldCls, className)} {...rest} />
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldCls, 'min-h-24', className)} {...rest} />
}

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldCls, className)} {...rest} />
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900', className)}>
      {children}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 text-sm text-zinc-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6" onMouseDown={onClose}>
      <div
        className={cx('w-full rounded-lg bg-white p-5 shadow-xl dark:bg-zinc-900', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function confirmDialog(msg: string): boolean {
  return window.confirm(msg)
}
