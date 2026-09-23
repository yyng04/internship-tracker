import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { addApplication } from '../db/repo'
import { openDashboard, todayISO } from '../lib/utils'
import { SOURCES, STATUSES, STATUS_LABELS, type CapturedJob, type Source, type Status } from '../types'

type Phase = 'loading' | 'form' | 'saved' | 'unsupported'

const EMPTY_JOB: CapturedJob = { title: '', company: '', url: '', location: '', source: 'other' }

function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Current page'
  }
}

function companyFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'lifeattiktok.com' || host.endsWith('.lifeattiktok.com')) return 'TikTok'
    return ''
  } catch {
    return ''
  }
}

export function Popup() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [job, setJob] = useState<CapturedJob>(EMPTY_JOB)
  const [status, setStatus] = useState<Status>('wishlist')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')

  const duplicate = useLiveQuery(
    () => (job.url ? db.applications.where('url').equals(job.url).first() : undefined),
    [job.url],
  )

  useEffect(() => {
    ;(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
        setPhase('unsupported')
        return
      }
      try {
        const captured = (await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_JOB' })) as CapturedJob
        setJob({ ...captured, company: captured.company || companyFromUrl(captured.url) })
      } catch {
        // The current tab may have been loaded before the extension was installed.
        setJob({ title: tab.title ?? '', company: companyFromUrl(tab.url), url: tab.url, location: '', source: 'other' })
      }
      setPhase('form')
    })()
  }, [])

  function update(key: keyof CapturedJob, value: string) {
    setJob((current) => ({ ...current, [key]: value }))
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || duplicate || !job.title.trim()) return
    setSaving(true)
    setError('')
    try {
      const application = await addApplication({
        company: job.company.trim(),
        role: job.title.trim(),
        location: job.location.trim(),
        url: job.url.trim(),
        source: job.source,
        status,
        appliedAt: status === 'applied' ? todayISO() : undefined,
      })
      setSavedId(application.id)
      setPhase('saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this role. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="capture-popup">
      <main className="capture-main">
        {phase === 'loading' && <p className="capture-message">Reading this page…</p>}

        {phase === 'unsupported' && (
          <div className="capture-state">
            <h1>Open a job listing</h1>
            <p>Capture works on regular web pages. You can also add a role from the dashboard.</p>
            <button type="button" className="capture-primary" onClick={() => openDashboard()}>
              Open dashboard <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}

        {phase === 'saved' && (
          <div className="capture-state">
            <span className="capture-success-mark" aria-hidden="true">✓</span>
            <h1>Added to {STATUS_LABELS[status].toLowerCase()}</h1>
            <p>{job.title}{job.company.trim() ? ` at ${job.company.trim()}` : ''} is in your tracker.</p>
            <button type="button" className="capture-primary" onClick={() => openDashboard('/app/' + savedId)}>
              View application <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={save}>
            <div className="capture-heading">
              <div className="capture-heading-row">
                <span className="capture-mark" aria-hidden="true" />
                <h1>Save this role</h1>
                <button type="button" className="capture-header-link" onClick={() => openDashboard()}>
                  Dashboard <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>

            {duplicate && (
              <div className="capture-duplicate" role="status">
                <span><strong>Already in {STATUS_LABELS[duplicate.status]}</strong></span>
                <button type="button" onClick={() => openDashboard('/app/' + duplicate.id)}>View ↗</button>
              </div>
            )}

            <div className="capture-fields">
              <label className="capture-field">
                <span>Role</span>
                <textarea
                  rows={2}
                  value={job.title}
                  onChange={(event) => update('title', event.target.value)}
                  placeholder="Job title"
                  required
                  className="capture-role"
                />
              </label>

              <label className="capture-field">
                <span>Company <em>(optional)</em></span>
                <input value={job.company} onChange={(event) => update('company', event.target.value)} placeholder="Company" />
              </label>

              <label className="capture-field">
                <span>Stage</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                  {STATUSES.map((stage) => <option key={stage} value={stage}>{STATUS_LABELS[stage]}</option>)}
                </select>
              </label>
            </div>

            <details className="capture-details">
              <summary>Listing link &amp; source <span>{siteName(job.url)}</span></summary>
              <div className="capture-details-fields">
                <label className="capture-field">
                  <span>Location <em>(optional)</em></span>
                  <input value={job.location} onChange={(event) => update('location', event.target.value)} placeholder="Add location" />
                </label>
                <label className="capture-field">
                  <span>Listing URL</span>
                  <input type="url" value={job.url} onChange={(event) => update('url', event.target.value)} placeholder="https://" />
                </label>
                <label className="capture-field">
                  <span>Source</span>
                  <select value={job.source} onChange={(event) => update('source', event.target.value as Source)}>
                    {SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </label>
              </div>
            </details>

            {error && <p className="capture-error" role="alert">{error}</p>}

            {!duplicate && (
              <button type="submit" className="capture-primary" disabled={saving || !job.title.trim()}>
                {saving ? 'Saving…' : 'Add to tracker'}
                {!saving && <span aria-hidden="true">→</span>}
              </button>
            )}
            <p className="capture-footnote">Stored in this browser profile.</p>
          </form>
        )}
      </main>
    </div>
  )
}
