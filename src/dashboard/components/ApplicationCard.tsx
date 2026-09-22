import { Link } from 'react-router-dom'
import type { Application } from '../../types'
import { fmtDate, todayISO } from '../../lib/utils'

const CLOSED: readonly string[] = ['offer', 'rejected', 'withdrawn']

/** 'overdue' if a follow-up or deadline is past, 'due' if it is today, else null. */
function dueState(app: Application, today = todayISO()): 'due' | 'overdue' | null {
  if (CLOSED.includes(app.status)) return null
  const dates = [app.followUpAt, app.deadline].filter((d): d is string => !!d)
  if (dates.some((d) => d < today)) return 'overdue'
  if (dates.some((d) => d === today)) return 'due'
  return null
}

export function ApplicationCard({ application }: { application: Application }) {
  const due = dueState(application)
  return (
    <Link
      to={`/app/${application.id}`}
      className="block rounded border border-zinc-200 bg-white p-2.5 text-sm shadow-sm transition hover:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{application.company}</div>
          <div className="truncate text-zinc-700 dark:text-zinc-300">{application.role}</div>
          {application.location && (
            <div className="truncate text-xs text-zinc-500">{application.location}</div>
          )}
        </div>
        {due && (
          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-100">
            {due === 'due' ? 'Due' : 'Overdue'}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="capitalize">{application.source}</span>
        {application.appliedAt && <span>{fmtDate(application.appliedAt)}</span>}
      </div>
    </Link>
  )
}
