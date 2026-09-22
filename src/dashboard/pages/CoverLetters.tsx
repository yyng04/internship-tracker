import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import {
  addCoverLetter,
  deleteCoverLetter,
  getProfile,
  renderTemplate,
  updateApplication,
  updateCoverLetter,
} from '../../db/repo'
import { markdownToPlain } from '../../lib/markdown'
import { copyText, cx, download, fmtDate, todayISO } from '../../lib/utils'
import type { Application, CoverLetter, Template } from '../../types'
import { MarkdownEditor } from '../components/MarkdownEditor'
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  confirmDialog,
} from '../components/ui'

const appLabel = (a: Application) => `${a.company}: ${a.role}`

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cover-letter'
}

export function CoverLetters() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const letters = useLiveQuery(() => db.coverLetters.orderBy('updatedAt').reverse().toArray(), [], [] as CoverLetter[])
  const apps = useLiveQuery(() => db.applications.orderBy('company').toArray(), [], [] as Application[])
  const templates = useLiveQuery(() => db.templates.orderBy('name').toArray(), [], [] as Template[])
  const profile = useLiveQuery(() => getProfile(), [])
  const appById = new Map(apps.map((a) => [a.id, a]))

  // ---- new letter modal ----
  const [modalOpen, setModalOpen] = useState(false)
  const [formAppId, setFormAppId] = useState('')
  const [formTemplateId, setFormTemplateId] = useState('')
  const [formTitle, setFormTitle] = useState('Untitled')
  const [titleTouched, setTitleTouched] = useState(false)
  const [creating, setCreating] = useState(false)

  const openModal = (appId = '') => {
    setFormAppId(appId)
    setFormTemplateId('')
    setFormTitle('Untitled')
    setTitleTouched(false)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    if (searchParams.has('for')) setSearchParams({}, { replace: true })
  }

  // ?for=<applicationId> opens the modal with that application preselected.
  const forParam = searchParams.get('for')
  useEffect(() => {
    if (forParam && !modalOpen) openModal(forParam)
  }, [forParam])

  // Keep the default title in sync with the chosen application until the user edits it.
  useEffect(() => {
    if (titleTouched) return
    const app = appById.get(formAppId)
    setFormTitle(app ? `${app.company} cover letter` : 'Untitled')
  }, [formAppId, apps])

  const create = async () => {
    setCreating(true)
    try {
      const app = appById.get(formAppId)
      const tpl = templates.find((t) => t.id === formTemplateId)
      const p = profile ?? (await getProfile())
      const vars: Record<string, string | undefined> = {
        company: app?.company,
        role: app?.role,
        location: app?.location,
        date: fmtDate(todayISO()),
        name: p.fullName,
        email: p.email,
        phone: p.phone,
        school: p.school,
      }
      const cl = await addCoverLetter({
        title: formTitle.trim() || 'Untitled',
        body: tpl ? renderTemplate(tpl.body, vars) : '',
        applicationId: app?.id,
        templateId: tpl?.id,
      })
      setModalOpen(false)
      navigate(`/letters/${cl.id}`, { replace: Boolean(forParam) })
    } finally {
      setCreating(false)
    }
  }

  const selected = id ? letters.find((l) => l.id === id) : undefined

  return (
    <div>
      <PageHeader
        title="Cover letters"
        actions={
          <Button variant="primary" onClick={() => openModal()}>
            New cover letter
          </Button>
        }
      />

      {letters.length === 0 ? (
        <EmptyState
          title="No cover letters yet"
          body='Use "New cover letter" above to start one, optionally from a template and linked to an application.'
          action={
            <Button variant="primary" onClick={() => openModal()}>
              New cover letter
            </Button>
          }
        />
      ) : (
        <div className="flex gap-5">
          <aside className="w-72 shrink-0">
            <ul className="space-y-1">
              {letters.map((l) => {
                const active = l.id === id
                const app = l.applicationId ? appById.get(l.applicationId) : undefined
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => navigate(`/letters/${l.id}`)}
                      className={cx(
                        'block w-full rounded px-3 py-2 text-left text-sm',
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                      )}
                    >
                      <div className="truncate font-medium">{l.title || 'Untitled'}</div>
                      <div className={cx('truncate text-xs', active ? 'text-indigo-100' : 'text-zinc-500')}>
                        {app ? appLabel(app) : 'Not linked'}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <div className="min-w-0 flex-1">
            {selected ? (
              <LetterEditor key={selected.id} letter={selected} apps={apps} onDeleted={() => navigate('/letters')} />
            ) : (
              <Card className="flex min-h-48 items-center justify-center text-sm text-zinc-500">
                Select a letter
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title="New cover letter">
        <div className="space-y-3">
          <Field label="For application" hint="Optional. Fills {company}, {role} and {location} in the template.">
            <Select value={formAppId} onChange={(e) => setFormAppId(e.target.value)}>
              <option value="">Not linked</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {appLabel(a)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start from template">
            <Select value={formTemplateId} onChange={(e) => setFormTemplateId(e.target.value)}>
              <option value="">Blank</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <Input
              value={formTitle}
              onChange={(e) => {
                setFormTitle(e.target.value)
                setTitleTouched(true)
              }}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={create} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Keyed by letter id from the parent so local state resets when switching letters.
function LetterEditor({
  letter,
  apps,
  onDeleted,
}: {
  letter: CoverLetter
  apps: Application[]
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(letter.title)
  const [body, setBody] = useState(letter.body)
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving'>('saved')
  const [copied, setCopied] = useState(false)
  const lastSavedBody = useRef(letter.body)
  const latestBody = useRef(letter.body)
  latestBody.current = body

  // Debounced autosave of the body, 600ms after the last keystroke.
  useEffect(() => {
    if (body === lastSavedBody.current) return
    setSaveState('pending')
    const t = setTimeout(async () => {
      setSaveState('saving')
      await updateCoverLetter(letter.id, { body })
      lastSavedBody.current = body
      setSaveState('saved')
    }, 600)
    return () => clearTimeout(t)
  }, [body, letter.id])

  // Flush anything still pending if the user navigates away mid-debounce.
  useEffect(() => {
    return () => {
      if (latestBody.current !== lastSavedBody.current) {
        void updateCoverLetter(letter.id, { body: latestBody.current })
      }
    }
  }, [letter.id])

  const saveTitle = async () => {
    const t = title.trim() || 'Untitled'
    setTitle(t)
    if (t !== letter.title) await updateCoverLetter(letter.id, { title: t })
  }

  const relink = async (nextAppId: string) => {
    const prev = letter.applicationId
    const next = nextAppId || undefined
    if (prev === next) return
    if (prev) await updateApplication(prev, { coverLetterId: undefined })
    await updateCoverLetter(letter.id, { applicationId: next })
    if (next) await updateApplication(next, { coverLetterId: letter.id })
  }

  const copy = async () => {
    await copyText(markdownToPlain(body))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const remove = async () => {
    if (!confirmDialog(`Delete "${letter.title || 'Untitled'}"? This cannot be undone.`)) return
    lastSavedBody.current = latestBody.current // stop the unmount flush from resurrecting it
    await deleteCoverLetter(letter.id)
    onDeleted()
  }

  const linkedApp = letter.applicationId ? apps.find((a) => a.id === letter.applicationId) : undefined

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} />
        </Field>
        <Field label="Linked application">
          <Select value={letter.applicationId ?? ''} onChange={(e) => relink(e.target.value)}>
            <option value="">Not linked</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {appLabel(a)}
              </option>
            ))}
            {Boolean(letter.applicationId) && !linkedApp && (
              <option value={letter.applicationId}>Deleted application</option>
            )}
          </Select>
        </Field>
      </div>

      <MarkdownEditor value={body} onChange={setBody} placeholder="Write the cover letter in markdown." />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copy}>{copied ? 'Copied' : 'Copy as text'}</Button>
        <Button onClick={() => download(`${slugify(title)}.md`, body, 'text/markdown')}>Download .md</Button>
        <Button onClick={() => download(`${slugify(title)}.txt`, markdownToPlain(body), 'text/plain')}>
          Download .txt
        </Button>
        <Button variant="danger" onClick={remove}>
          Delete
        </Button>
        <span className="ml-auto text-xs text-zinc-500">
          {saveState === 'saved' ? `Saved ${fmtDate(letter.updatedAt)}` : 'Saving...'}
        </span>
      </div>
    </div>
  )
}
