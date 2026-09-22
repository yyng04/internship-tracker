import { useState, type FormEvent } from 'react'
import {
  SOURCES,
  STATUSES,
  STATUS_LABELS,
  type Application,
  type Source,
  type Status,
} from '../../types'
import { Button, Field, Input, Select, Textarea } from './ui'

/** The fields a user can edit. Everything else on Application is managed by repo.ts. */
export type ApplicationFormValues = {
  company: string
  role: string
  location: string
  url: string
  source: Source
  status: Status
  appliedAt?: string
  deadline?: string
  followUpAt?: string
  salary?: string
  tags: string[]
  notes: string
}

type Draft = Omit<ApplicationFormValues, 'tags' | 'appliedAt' | 'deadline' | 'followUpAt' | 'salary'> & {
  tags: string
  appliedAt: string
  deadline: string
  followUpAt: string
  salary: string
}

function toDraft(initial?: Partial<Application>): Draft {
  return {
    company: initial?.company === 'Unspecified company' ? '' : initial?.company ?? '',
    role: initial?.role ?? '',
    location: initial?.location ?? '',
    url: initial?.url ?? '',
    source: initial?.source ?? 'other',
    status: initial?.status ?? 'wishlist',
    appliedAt: initial?.appliedAt ?? '',
    deadline: initial?.deadline ?? '',
    followUpAt: initial?.followUpAt ?? '',
    salary: initial?.salary ?? '',
    tags: (initial?.tags ?? []).join(', '),
    notes: initial?.notes ?? '',
  }
}

const orUndef = (s: string) => (s.trim() ? s.trim() : undefined)

export function ApplicationForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: {
  initial?: Partial<Application>
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>
  onCancel: () => void
  submitLabel?: string
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((p) => ({ ...p, [key]: value }))

  const valid = d.role.trim().length > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        company: d.company.trim() || 'Unspecified company',
        role: d.role.trim(),
        location: d.location.trim(),
        url: d.url.trim(),
        source: d.source,
        status: d.status,
        appliedAt: orUndef(d.appliedAt),
        deadline: orUndef(d.deadline),
        followUpAt: orUndef(d.followUpAt),
        salary: orUndef(d.salary),
        tags: d.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes: d.notes,
      })
    } catch {
      setError('Could not save the application. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Company (optional)">
          <Input value={d.company} onChange={(e) => set('company', e.target.value)} autoFocus />
        </Field>
        <Field label="Role *">
          <Textarea value={d.role} onChange={(e) => set('role', e.target.value)} rows={2} required className="min-h-16 resize-y" />
        </Field>
        <Field label="Location">
          <Input value={d.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="URL">
          <Input type="url" value={d.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Source">
          <Select value={d.source} onChange={(e) => set('source', e.target.value as Source)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={d.status} onChange={(e) => set('status', e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Applied on">
          <Input type="date" value={d.appliedAt} onChange={(e) => set('appliedAt', e.target.value)} />
        </Field>
        <Field label="Deadline">
          <Input type="date" value={d.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </Field>
        <Field label="Follow up on">
          <Input type="date" value={d.followUpAt} onChange={(e) => set('followUpAt', e.target.value)} />
        </Field>
        <Field label="Salary">
          <Input value={d.salary} onChange={(e) => set('salary', e.target.value)} placeholder="e.g. 1500/month" />
        </Field>
      </div>
      <Field label="Tags" hint="Comma separated">
        <Input value={d.tags} onChange={(e) => set('tags', e.target.value)} placeholder="fintech, remote" />
      </Field>
      <Field label="Notes">
        <Textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!valid || busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
