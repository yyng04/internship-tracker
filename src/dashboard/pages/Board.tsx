import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { addApplication, setStatus } from '../../db/repo'
import { STATUSES, STATUS_LABELS, type Application, type Status } from '../../types'
import { cx, fmtDate, todayISO } from '../../lib/utils'
import { Button, EmptyState, Input, Modal, PageHeader, StatusBadge } from '../components/ui'
import { ApplicationCard } from '../components/ApplicationCard'
import { ApplicationForm, type ApplicationFormValues } from '../components/ApplicationForm'

type View = 'kanban' | 'table'
const VIEW_KEY = 'it.boardView'

function loadView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'kanban' || v === 'table') return v
  } catch {
    // storage unavailable
  }
  return 'kanban'
}

function saveView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // storage unavailable
  }
}

const CLOSED: readonly string[] = ['offer', 'rejected', 'withdrawn']
const isOpen = (a: Application) => !CLOSED.includes(a.status)

/** Same rule as listDue() in repo.ts. */
function isDue(a: Application, today: string): boolean {
  return isOpen(a) && ((!!a.followUpAt && a.followUpAt <= today) || (!!a.deadline && a.deadline <= today))
}

function matches(a: Application, q: string): boolean {
  if (!q) return true
  const hay = [a.company, a.role, a.location, ...a.tags].join(' ').toLowerCase()
  return hay.includes(q)
}

export function Board() {
  const apps = useLiveQuery(() => db.applications.toArray(), [])
  const [params, setParams] = useSearchParams()
  const dueOnly = params.get('filter') === 'due'

  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>(loadView)
  const [adding, setAdding] = useState(false)

  const changeView = (v: View) => {
    setView(v)
    saveView(v)
  }

  const clearFilter = () => {
    const next = new URLSearchParams(params)
    next.delete('filter')
    setParams(next, { replace: true })
  }

  const today = todayISO()
  const visible = useMemo(() => {
    if (!apps) return []
    const q = query.trim().toLowerCase()
    return apps.filter((a) => (!dueOnly || isDue(a, today)) && matches(a, q))
  }, [apps, query, dueOnly, today])

  const onAdd = async (v: ApplicationFormValues) => {
    await addApplication(v)
    setAdding(false)
  }

  if (apps === undefined) return null

  const subtitle =
    apps.length === 0
      ? 'No applications yet'
      : visible.length === apps.length
        ? `${apps.length} application${apps.length === 1 ? '' : 's'}`
        : `${visible.length} of ${apps.length} applications`

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle={subtitle}
        actions={
          <>
            <Input
              type="search"
              placeholder="Search company, role, location, tags"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-64"
            />
            <div className="inline-flex overflow-hidden rounded border border-zinc-300 dark:border-zinc-700">
              <Button
                size="md"
                variant="ghost"
                className={cx('rounded-none', view === 'kanban' && 'bg-zinc-200 dark:bg-zinc-700')}
                onClick={() => changeView('kanban')}
                aria-pressed={view === 'kanban'}
              >
                Kanban
              </Button>
              <Button
                size="md"
                variant="ghost"
                className={cx('rounded-none', view === 'table' && 'bg-zinc-200 dark:bg-zinc-700')}
                onClick={() => changeView('table')}
                aria-pressed={view === 'table'}
              >
                Table
              </Button>
            </div>
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add application
            </Button>
          </>
        }
      />

      {dueOnly && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-100">
          Showing items needing attention
          <button onClick={clearFilter} className="font-medium underline" aria-label="Clear filter">
            Clear
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          body="Track internships you have applied to or want to apply to."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add application
            </Button>
          }
        />
      ) : view === 'kanban' ? (
        <Kanban apps={visible} />
      ) : (
        <Table apps={visible} today={today} />
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add application" wide>
        <ApplicationForm onSubmit={onAdd} onCancel={() => setAdding(false)} submitLabel="Add" />
      </Modal>
    </div>
  )
}

// ---------- kanban ----------

function Kanban({ apps }: { apps: Application[] }) {
  const [over, setOver] = useState<Status | null>(null)

  const byStatus = useMemo(() => {
    const m = Object.fromEntries(STATUSES.map((s) => [s, [] as Application[]])) as Record<Status, Application[]>
    for (const a of apps) m[a.status].push(a)
    return m
  }, [apps])

  const onDrop = useCallback(async (e: DragEvent, status: Status) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData('text/plain')
    if (id) await setStatus(id, status)
  }, [])

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {STATUSES.map((s) => (
        <div
          key={s}
          className={cx(
            'flex min-w-56 flex-1 flex-col rounded-lg border p-2 transition',
            over === s
              ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950'
              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (over !== s) setOver(s)
          }}
          onDragLeave={(e) => {
            // Only clear when the pointer leaves the column itself, not a child.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null)
          }}
          onDrop={(e) => onDrop(e, s)}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              {STATUS_LABELS[s]}
            </span>
            <span className="rounded-full bg-zinc-200 px-1.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              {byStatus[s].length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {byStatus[s].map((a) => (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', a.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                <ApplicationCard application={a} />
              </div>
            ))}
            {byStatus[s].length === 0 && (
              <div className="rounded border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-400 dark:border-zinc-700">
                Drop here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- table ----------

type SortKey = 'company' | 'role' | 'location' | 'status' | 'appliedAt' | 'deadline' | 'followUpAt' | 'source'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'appliedAt', label: 'Applied' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'followUpAt', label: 'Follow-up' },
  { key: 'source', label: 'Source' },
]

function sortValue(a: Application, key: SortKey): string | number {
  if (key === 'status') return STATUSES.indexOf(a.status)
  const v = a[key]
  return (v ?? '').toLowerCase()
}

function Table({ apps, today }: { apps: Application[]; today: string }) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('company')
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    const list = [...apps]
    list.sort((x, y) => {
      const vx = sortValue(x, sortKey)
      const vy = sortValue(y, sortKey)
      // Empty strings (missing dates) always sort last regardless of direction.
      if (vx === '' && vy !== '') return 1
      if (vy === '' && vx !== '') return -1
      const c = vx < vy ? -1 : vx > vy ? 1 : 0
      return asc ? c : -c
    })
    return list
  }, [apps, sortKey, asc])

  const onSort = (key: SortKey) => {
    if (key === sortKey) setAsc((p) => !p)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  const dateCell = (a: Application, iso?: string) => {
    if (!iso) return <span className="text-zinc-400">-</span>
    const hot = iso <= today && isOpen(a)
    return <span className={cx(hot && 'text-red-600 dark:text-red-400')}>{fmtDate(iso)}</span>
  }

  if (apps.length === 0) {
    return <EmptyState title="Nothing matches" body="Try a different search or clear the filter." />
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-2 font-semibold">
                <button
                  onClick={() => onSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {c.label}
                  {sortKey === c.key && <span aria-hidden>{asc ? '▲' : '▼'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr
              key={a.id}
              onClick={() => navigate(`/app/${a.id}`)}
              className="cursor-pointer border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
            >
              <td className="px-3 py-2 font-medium">{a.company}</td>
              <td className="px-3 py-2">{a.role}</td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{a.location}</td>
              <td className="px-3 py-2">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{a.appliedAt ? fmtDate(a.appliedAt) : <span className="text-zinc-400">-</span>}</td>
              <td className="px-3 py-2 whitespace-nowrap">{dateCell(a, a.deadline)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{dateCell(a, a.followUpAt)}</td>
              <td className="px-3 py-2 capitalize text-zinc-600 dark:text-zinc-400">{a.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
