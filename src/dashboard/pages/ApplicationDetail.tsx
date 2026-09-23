import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { assignCoverLetter, deleteApplication, setStatus, unlinkApplicationCoverLetter, updateApplication } from '../../db/repo'
import { STATUSES, STATUS_LABELS, type Application, type Status } from '../../types'
import { companyLabel, copyText, daysBetween, fmtDate, todayISO } from '../../lib/utils'
import {
  Button,
  Card,
  EmptyState,
  Modal,
  Select,
  StatusBadge,
  confirmDialog,
} from '../components/ui'
import { ApplicationForm, type ApplicationFormValues } from '../components/ApplicationForm'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words">{children}</dd>
    </div>
  )
}

const dash = <span className="text-zinc-400">-</span>

export function ApplicationDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const app = useLiveQuery(async () => (await db.applications.get(id)) ?? null, [id])
  const letters = useLiveQuery(() => db.coverLetters.toArray(), [], [])
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (app === undefined) return null
  if (app === null) {
    return (
      <EmptyState
        title="Application not found"
        body="It may have been deleted."
        action={
          <Link to="/board" className="text-sm text-indigo-600 underline">
            Back to board
          </Link>
        }
      />
    )
  }

  const a: Application = app
  const linked = a.coverLetterId ? letters.find((l) => l.id === a.coverLetterId) : undefined
  const today = todayISO()

  const onCopy = async () => {
    try {
      await copyText(a.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked; nothing to do
    }
  }

  const onDelete = async () => {
    if (!confirmDialog(`Delete the application to ${companyLabel(a.company)}? This cannot be undone.`)) return
    await deleteApplication(a.id)
    navigate('/board')
  }

  const onEdit = async (v: ApplicationFormValues) => {
    const { status, ...rest } = v
    await updateApplication(a.id, rest)
    if (status !== a.status) await setStatus(a.id, status)
    setEditing(false)
  }

  const history = [...a.history].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{companyLabel(a.company)}</h1>
            <StatusBadge status={a.status} />
          </div>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {a.role}
            {a.location && <span className="text-zinc-400"> · {a.location}</span>}
          </p>
          {a.appliedAt && (
            <p className="mt-0.5 text-xs text-zinc-500">
              Applied {fmtDate(a.appliedAt)} ({daysBetween(a.appliedAt, today)} days ago)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={a.status}
            onChange={(e) => setStatus(a.id, e.target.value as Status)}
            className="w-auto"
            aria-label="Change status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          {a.url && (
            <>
              <Button onClick={() => window.open(a.url, '_blank', 'noopener,noreferrer')}>Open listing</Button>
              <Button onClick={onCopy}>{copied ? 'Copied' : 'Copy URL'}</Button>
            </>
          )}
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Details</h2>
          <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <Row label="Company">{companyLabel(a.company)}</Row>
            <Row label="Role">{a.role}</Row>
            <Row label="Location">{a.location || dash}</Row>
            <Row label="URL">
              {a.url ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                  {a.url}
                </a>
              ) : (
                dash
              )}
            </Row>
            <Row label="Source">
              <span className="capitalize">{a.source}</span>
            </Row>
            <Row label="Status">
              <StatusBadge status={a.status} />
            </Row>
            <Row label="Applied">{a.appliedAt ? fmtDate(a.appliedAt) : dash}</Row>
            <Row label="Deadline">{a.deadline ? fmtDate(a.deadline) : dash}</Row>
            <Row label="Follow up">{a.followUpAt ? fmtDate(a.followUpAt) : dash}</Row>
            <Row label="Salary">{a.salary || dash}</Row>
            <Row label="Tags">
              {a.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                dash
              )}
            </Row>
            <Row label="Created">{fmtDate(a.createdAt)}</Row>
            <Row label="Updated">{fmtDate(a.updatedAt)}</Row>
          </dl>
          <h3 className="mt-4 mb-1 text-sm font-semibold">Notes</h3>
          {a.notes ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-800 dark:text-zinc-200">{a.notes}</pre>
          ) : (
            <p className="text-sm text-zinc-400">No notes</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Timeline</h2>
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex items-center gap-2 text-sm">
                  <StatusBadge status={h.status} />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {fmtDate(h.at)}{' '}
                    {new Date(h.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold">Cover letter</h2>
            {a.coverLetterId ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <Link to={`/letters/${a.coverLetterId}`} className="truncate text-indigo-600 underline">
                  {linked?.title ?? 'Untitled letter'}
                </Link>
                <Button size="sm" onClick={() => void unlinkApplicationCoverLetter(a.id)}>
                  Unlink
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) void assignCoverLetter(e.target.value, a.id)
                  }}
                  aria-label="Link a cover letter"
                >
                  <option value="">Link an existing letter</option>
                  {letters.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title || 'Untitled'}
                    </option>
                  ))}
                </Select>
                <Link to={`/letters?for=${a.id}`} className="inline-block text-indigo-600 underline">
                  Write a new one
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit application" wide>
        <ApplicationForm initial={a} onSubmit={onEdit} onCancel={() => setEditing(false)} />
      </Modal>
    </div>
  )
}
