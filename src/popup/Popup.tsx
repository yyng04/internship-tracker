import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { addApplication, listDue } from '../db/repo'
import { openDashboard, todayISO } from '../lib/utils'
import { SOURCES, STATUSES, STATUS_LABELS, type CapturedJob, type Source, type Status } from '../types'

type Phase = 'loading' | 'form' | 'saved' | 'unsupported'

export function Popup() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [job, setJob] = useState<CapturedJob>({ title: '', company: '', url: '', location: '', source: 'other' })
  const [status, setStatus] = useState<Status>('applied')
  const [dueCount, setDueCount] = useState(0)

  const total = useLiveQuery(() => db.applications.count(), [], 0)
  const duplicate = useLiveQuery(
    () => (job.url ? db.applications.where('url').equals(job.url).first() : undefined),
    [job.url],
  )

  useEffect(() => {
    listDue().then((d) => setDueCount(d.length))
    ;(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
        setPhase('unsupported')
        return
      }
      try {
        const res = (await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_JOB' })) as CapturedJob
        setJob(res)
      } catch {
        // content script not injected (page loaded before install); fall back to tab info
        setJob({ title: tab.title ?? '', company: '', url: tab.url, location: '', source: 'other' })
      }
      setPhase('form')
    })()
  }, [])

  async function save() {
    await addApplication({
      company: job.company.trim(),
      role: job.title.trim(),
      location: job.location.trim(),
      url: job.url,
      source: job.source,
      status,
      appliedAt: status === 'applied' ? todayISO() : undefined,
    })
    setPhase('saved')
  }

  const field = (label: string, key: keyof CapturedJob) => (
    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      <input
        className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        value={job[key]}
        onChange={(e) => setJob({ ...job, [key]: e.target.value })}
      />
    </label>
  )

  return (
    <div className="p-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-base font-semibold">Internship Tracker</h1>
        <button
          onClick={() => openDashboard()}
          className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Open dashboard
        </button>
      </header>

      <div className="mb-3 flex gap-2 text-xs text-zinc-500">
        <span>{total} tracked</span>
        {dueCount > 0 && (
          <button className="text-red-600 underline" onClick={() => openDashboard('/board?filter=due')}>
            {dueCount} need attention
          </button>
        )}
      </div>

      {phase === 'loading' && <p className="text-sm text-zinc-500">Reading page...</p>}

      {phase === 'unsupported' && (
        <p className="text-sm text-zinc-500">
          Open a job listing in a normal tab to capture it, or add applications from the dashboard.
        </p>
      )}

      {phase === 'saved' && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          Saved {job.company || 'application'}.
          <button className="ml-2 underline" onClick={() => openDashboard('/board')}>
            View
          </button>
        </div>
      )}

      {phase === 'form' && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {duplicate && (
            <p className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Already tracked as {duplicate.company} ({STATUS_LABELS[duplicate.status]}).
            </p>
          )}
          {field('Company', 'company')}
          {field('Role', 'title')}
          {field('Location', 'location')}
          {field('URL', 'url')}
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Status
              <select
                className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Source
              <select
                className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={job.source}
                onChange={(e) => setJob({ ...job, source: e.target.value as Source })}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={!job.company.trim() || !job.title.trim()}
            className="mt-2 w-full rounded bg-indigo-600 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Save application
          </button>
        </form>
      )}
    </div>
  )
}
