import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import {
  addCoverLetter,
  assignCoverLetter,
  EMPTY_PROFILE,
  deleteCoverLetter,
  getProfile,
  renderTemplate,
  updateCoverLetter,
} from '../../db/repo'
import { markdownToPlain } from '../../lib/markdown'
import { companyLabel, copyText, cx, fmtDate, todayISO } from '../../lib/utils'
import type { Application, CoverLetter, Template } from '../../types'
import { ListingDetails } from '../components/ListingDetails'
import { LetterPreview } from '../letter/LetterPreview'
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  confirmDialog,
} from '../components/ui'

const appLabel = (a: Application) => `${companyLabel(a.company)}: ${a.role}`

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
  const [createError, setCreateError] = useState('')

  const openModal = (appId = '') => {
    setCreateError('')
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
    setFormTitle(app ? `${companyLabel(app.company)} cover letter` : 'Untitled')
  }, [formAppId, apps])

  const create = async () => {
    setCreating(true)
    setCreateError('')
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
    } catch {
      setCreateError('Could not create the cover letter. Please try again.')
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
        <div className="flex flex-col gap-5 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-72">
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
                          ? 'bg-indigo-600 text-zinc-950'
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
          {createError && <p role="alert" className="text-sm text-red-400">{createError}</p>}
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
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved')
  const [copied, setCopied] = useState(false)
  const linkedApp = letter.applicationId ? apps.find((a) => a.id === letter.applicationId) : undefined
  // Open on the job's requirements when there are some to write against.
  const [pane, setPane] = useState<'letter' | 'job'>(linkedApp?.description ? 'job' : 'letter')
  const profile = useLiveQuery(() => getProfile(), [])
  const textWrap = useRef<HTMLDivElement>(null)
  const lastSavedBody = useRef(letter.body)
  const latestBody = useRef(letter.body)

  const changeBody = (next: string) => {
    latestBody.current = next
    setBody(next)
    setSaveState('pending')
  }

  // Debounced autosave of the body, 600ms after the last keystroke.
  useEffect(() => {
    if (body === lastSavedBody.current) return
    const t = setTimeout(async () => {
      setSaveState('saving')
      try {
        await updateCoverLetter(letter.id, { body })
        lastSavedBody.current = body
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 600)
    return () => clearTimeout(t)
  }, [body, letter.id])

  // Flush anything still pending if the user navigates away mid-debounce.
  useEffect(() => {
    return () => {
      if (latestBody.current !== lastSavedBody.current) {
        void updateCoverLetter(letter.id, { body: latestBody.current }).catch(() => {})
      }
    }
  }, [letter.id])

  const saveTitle = async () => {
    const t = title.trim() || 'Untitled'
    setTitle(t)
    if (t !== letter.title) {
      try {
        await updateCoverLetter(letter.id, { title: t })
      } catch {
        setSaveState('error')
      }
    }
  }

  const relink = async (nextAppId: string) => {
    const next = nextAppId || undefined
    if (letter.applicationId === next) return
    try {
      await assignCoverLetter(letter.id, next)
    } catch {
      setSaveState('error')
    }
  }

  const copy = async () => {
    try {
      await copyText(markdownToPlain(body))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  // Grow the textarea with its content instead of scrolling inside it.
  useEffect(() => {
    const el = textWrap.current?.querySelector('textarea')
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  // Save any pending edit first, so the print tab reads the current text.
  const savePdf = async () => {
    if (latestBody.current !== lastSavedBody.current) {
      await updateCoverLetter(letter.id, { body: latestBody.current })
      lastSavedBody.current = latestBody.current
      setSaveState('saved')
    }
    window.open(`${location.href.split('#')[0]}#/letters/${letter.id}/print`, '_blank')
  }

  const remove = async () => {
    if (!confirmDialog(`Delete "${letter.title || 'Untitled'}"? This cannot be undone.`)) return
    try {
      await deleteCoverLetter(letter.id)
      lastSavedBody.current = latestBody.current // stop the unmount flush from resurrecting it
      onDeleted()
    } catch {
      setSaveState('error')
    }
  }

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div ref={textWrap}>
          <Textarea
            rows={22}
            value={body}
            placeholder={'Dear Hiring Team,\n\nI am applying for...\n\nKind regards,\nYour name'}
            onChange={(e) => changeBody(e.target.value)}
            className="resize-none overflow-hidden text-sm leading-relaxed"
            aria-label="Letter text"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Start at the greeting. Your name, contact details, the date and the recipient are added on the letter.
            Leave a blank line between paragraphs. **bold**, *italic* and lines starting with "- " also work.
          </p>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex gap-1">
            <Button size="sm" variant={pane === 'letter' ? 'primary' : 'ghost'} onClick={() => setPane('letter')}>
              Letter
            </Button>
            <Button size="sm" variant={pane === 'job' ? 'primary' : 'ghost'} onClick={() => setPane('job')}>
              Job requirements
            </Button>
          </div>
          {pane === 'letter' ? (
            <>
              {profile && !profile.fullName && (
                <p className="mb-2 text-xs text-zinc-500">
                  The header uses your name and contact details from{' '}
                  <Link to="/profile" className="underline">
                    Profile
                  </Link>
                  .
                </p>
              )}
              <LetterPreview body={body} profile={profile ?? EMPTY_PROFILE} application={linkedApp} />
            </>
          ) : (
            <Card>
              {linkedApp ? (
                <ListingDetails description={linkedApp.description} compact />
              ) : (
                <p className="text-sm text-zinc-500">Link this letter to an application to see its requirements here.</p>
              )}
            </Card>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void savePdf()}>
          Save as PDF
        </Button>
        <Button onClick={copy}>{copied ? 'Copied' : 'Copy as text'}</Button>
        <Button variant="danger" onClick={remove}>
          Delete
        </Button>
        <span className="ml-auto text-xs text-zinc-500">
          {saveState === 'saved' ? `Saved ${fmtDate(letter.updatedAt)}` : saveState === 'error' ? 'Change failed, try again' : 'Saving...'}
        </span>
      </div>
    </div>
  )
}
