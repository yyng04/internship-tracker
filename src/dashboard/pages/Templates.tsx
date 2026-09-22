import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import {
  addTemplate,
  deleteTemplate,
  getProfile,
  renderTemplate,
  updateTemplate,
} from '../../db/repo'
import { renderMarkdown } from '../../lib/markdown'
import { cx, fmtDate, todayISO } from '../../lib/utils'
import type { Template } from '../../types'
import { MarkdownEditor, PREVIEW_CLS } from '../components/MarkdownEditor'
import { Button, Card, EmptyState, Field, Input, PageHeader, confirmDialog } from '../components/ui'

const STARTER_NAME = 'Starter'
const STARTER_BODY = `{date}

Dear Hiring Team at {company},

I am writing to apply for the {role} position at {company}. I am a student at {school} and I am looking for an internship where I can apply what I have learned as part of a working team.

Through my coursework and project work I have built the habit of breaking problems into small steps, working to deadlines and explaining my results clearly to people outside the project. I would bring the same approach to this role.

I am interested in {company} because of the work your team does and the chance to learn from it. I would welcome the opportunity to discuss how I could contribute.

Thank you for your time and consideration.

{name}
{email}`

export function Templates() {
  const templates = useLiveQuery(() => db.templates.orderBy('updatedAt').reverse().toArray(), [], [] as Template[])
  const profile = useLiveQuery(() => getProfile(), [])

  // null selectedId means the editor holds a new, unsaved template.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [dirty, setDirty] = useState(false)
  const [showSample, setShowSample] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Lets the editor show for a brand new template when the list is empty.
  const [draftOpen, setDraftOpen] = useState(false)

  const load = (t: Template | null) => {
    setError('')
    setSelectedId(t?.id ?? null)
    setName(t?.name ?? '')
    setBody(t?.body ?? '')
    setDirty(false)
  }

  const guard = () => !dirty || confirmDialog('Discard unsaved changes to this template?')

  const select = (t: Template) => {
    if (t.id === selectedId) return
    if (!guard()) return
    load(t)
  }

  const startNew = () => {
    if (!guard()) return
    load(null)
    setDraftOpen(true)
  }

  const save = async () => {
    const trimmed = name.trim() || 'Untitled template'
    setSaving(true)
    setError('')
    try {
      if (selectedId) {
        await updateTemplate(selectedId, { name: trimmed, body })
      } else {
        const t = await addTemplate({ name: trimmed, body })
        setSelectedId(t.id)
      }
      setName(trimmed)
      setDirty(false)
    } catch {
      setError('Could not save the template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!selectedId) return
    if (!confirmDialog(`Delete template "${name || 'Untitled template'}"? Cover letters made from it are kept.`)) return
    try {
      await deleteTemplate(selectedId)
      load(null)
      setDraftOpen(false)
    } catch {
      setError('Could not delete the template. Please try again.')
    }
  }

  // Duplicates what is currently in the editor, including unsaved edits.
  const duplicate = async () => {
    try {
      const t = await addTemplate({ name: `${name.trim() || 'Untitled template'} (copy)`, body })
      load(t)
    } catch {
      setError('Could not duplicate the template. Please try again.')
    }
  }

  const createStarter = async () => {
    try {
      const t = await addTemplate({ name: STARTER_NAME, body: STARTER_BODY })
      load(t)
    } catch {
      setError('Could not create the starter template. Please try again.')
    }
  }

  const sampleVars: Record<string, string | undefined> = {
    company: 'Acme Corp',
    role: 'Software Engineering Intern',
    location: 'Singapore',
    date: fmtDate(todayISO()),
    name: profile?.fullName || 'Your Name',
    email: profile?.email || 'you@example.com',
    phone: profile?.phone || '+65 0000 0000',
    school: profile?.school || 'Your School',
  }

  const hasTemplates = templates.length > 0
  const showEditor = hasTemplates || draftOpen
  const editing = selectedId !== null || draftOpen

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Reusable cover letter bodies. Placeholders: {company} {role} {location} {date} {name} {email} {phone} {school}"
        actions={
          <Button variant="primary" onClick={startNew}>
            New template
          </Button>
        }
      />
      {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}

      {!showEditor ? (
        <EmptyState
          title="No templates yet"
          body="A template is a cover letter body with placeholders that get filled in per application."
          action={
            <div className="flex justify-center gap-2">
              <Button variant="primary" onClick={createStarter}>
                Create starter template
              </Button>
              <Button onClick={startNew}>Start blank</Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-64">
            {hasTemplates ? (
              <ul className="space-y-1">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => select(t)}
                      className={cx(
                        'block w-full rounded px-3 py-2 text-left text-sm',
                        t.id === selectedId
                          ? 'bg-indigo-600 text-zinc-950'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                      )}
                    >
                      <div className="truncate font-medium">{t.name || 'Untitled template'}</div>
                      <div className={cx('text-xs', t.id === selectedId ? 'text-indigo-100' : 'text-zinc-500')}>
                        Updated {fmtDate(t.updatedAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 text-sm text-zinc-500">Saved templates will appear here.</p>
            )}
          </aside>

          {!editing ? (
            <div className="min-w-0 flex-1">
              <EmptyState
                title="Choose a template"
                body="Select a saved template to edit it, or create a new one."
                action={<Button onClick={startNew}>New template</Button>}
              />
            </div>
          ) : (
          <div className="min-w-0 flex-1 space-y-4">
            <Field label="Name">
              <Input
                value={name}
                placeholder="e.g. Software engineering, general"
                onChange={(e) => {
                  setName(e.target.value)
                  setDirty(true)
                }}
              />
            </Field>

            <MarkdownEditor
              value={body}
              placeholder="Write the letter body here. Use {company}, {role}, {name} and the other placeholders."
              onChange={(v) => {
                setBody(v)
                setDirty(true)
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={save} disabled={saving || !dirty}>
                {saving ? 'Saving...' : selectedId ? 'Save' : 'Save template'}
              </Button>
              <Button onClick={duplicate} disabled={!name && !body}>
                Duplicate
              </Button>
              {selectedId && (
                <Button variant="danger" onClick={remove}>
                  Delete
                </Button>
              )}
              <span className="text-xs text-zinc-500">{dirty ? 'Unsaved changes' : selectedId ? 'Saved' : ''}</span>
              <label className="ml-auto flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Input
                  type="checkbox"
                  checked={showSample}
                  onChange={(e) => setShowSample(e.target.checked)}
                  className="w-auto accent-indigo-600"
                />
                Preview with sample values
              </label>
            </div>

            {showSample && (
              <Card>
                <div className="mb-2 text-xs font-medium text-zinc-500">
                  Sample: Acme Corp, Software Engineering Intern, Singapore, today, your profile
                </div>
                {body.trim() ? (
                  <div
                    className={PREVIEW_CLS}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(renderTemplate(body, sampleVars)) }}
                  />
                ) : (
                  <p className="text-sm text-zinc-400">Nothing to preview yet.</p>
                )}
              </Card>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  )
}
