import { useEffect, useState, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { EMPTY_PROFILE, deleteFile, getProfile, saveProfile, storeFile } from '../../db/repo'
import { copyText, download, fmtDate } from '../../lib/utils'
import type { Profile as ProfileRow, StoredFile } from '../../types'
import { Button, Card, Field, Input, PageHeader, Textarea, confirmDialog } from '../components/ui'
import { FileDrop } from '../components/FileDrop'

type TextKey = Exclude<keyof ProfileRow, 'id' | 'bullets'>

const FIELDS: { key: TextKey; label: string; placeholder?: string; type?: string }[] = [
  { key: 'fullName', label: 'Full name', placeholder: 'Jane Tan' },
  { key: 'email', label: 'Email', placeholder: 'jane@example.com', type: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '+65 9123 4567', type: 'tel' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...', type: 'url' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/...', type: 'url' },
  { key: 'portfolio', label: 'Portfolio', placeholder: 'https://...', type: 'url' },
  { key: 'school', label: 'School', placeholder: 'Nanyang Technological University' },
  { key: 'gradYear', label: 'Graduation year', placeholder: '2027' },
]

function fieldsEqual(a: ProfileRow, b: ProfileRow) {
  return FIELDS.every((f) => a[f.key] === b[f.key])
}

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Copy button that flips its label to "Copied" for a moment. */
function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'md' }) {
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1500)
    return () => clearTimeout(t)
  }, [done])
  return (
    <Button
      variant="ghost"
      size={size}
      onClick={() => {
        setFailed(false)
        void copyText(text).then(() => setDone(true)).catch(() => setFailed(true))
      }}
    >
      {done ? 'Copied' : failed ? 'Copy failed' : 'Copy'}
    </Button>
  )
}

export function Profile() {
  // `profile` is the live form state; `persisted` is the last snapshot written to the DB.
  const [profile, setProfile] = useState<ProfileRow>(EMPTY_PROFILE)
  const [persisted, setPersisted] = useState<ProfileRow>(EMPTY_PROFILE)
  const [savedFlash, setSavedFlash] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    let alive = true
    getProfile().then((p) => {
      if (!alive) return
      setProfile(p)
      setPersisted(p)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!savedFlash) return
    const t = setTimeout(() => setSavedFlash(false), 2000)
    return () => clearTimeout(t)
  }, [savedFlash])

  const dirty = !fieldsEqual(profile, persisted)

  function setField(key: TextKey, value: string) {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  async function persist(next: ProfileRow) {
    await saveProfile(next)
    setPersisted(next)
  }

  async function onSave() {
    setSavingProfile(true)
    setProfileError('')
    try {
      await persist(profile)
      setSavedFlash(true)
    } catch {
      setProfileError('Could not save your profile. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  // ----- bullets -----
  const [newBullet, setNewBullet] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [bulletBusy, setBulletBusy] = useState(false)
  const [bulletError, setBulletError] = useState('')

  // Save bullets without silently saving unrelated profile fields still in draft.
  async function setBullets(bullets: string[]): Promise<boolean> {
    setBulletBusy(true)
    setBulletError('')
    try {
      const next = { ...persisted, bullets }
      await saveProfile(next)
      setPersisted(next)
      setProfile((current) => ({ ...current, bullets }))
      return true
    } catch {
      setBulletError('Could not save the bullet. Please try again.')
      return false
    } finally {
      setBulletBusy(false)
    }
  }

  async function addBullet() {
    const text = newBullet.trim()
    if (!text || bulletBusy || savingProfile || editIdx !== null) return
    if (await setBullets([...profile.bullets, text])) setNewBullet('')
  }

  function startEdit(i: number) {
    setBulletError('')
    setEditIdx(i)
    setEditDraft(profile.bullets[i] ?? '')
  }

  async function commitEdit() {
    if (editIdx === null || savingProfile || bulletBusy) return
    const text = editDraft.trim()
    const i = editIdx
    if (!text) {
      setBulletError('A bullet cannot be empty. Use Remove to delete it.')
      return
    }
    if (text === profile.bullets[i]) {
      setEditIdx(null)
      return
    }
    const next = profile.bullets.slice()
    next[i] = text
    if (await setBullets(next)) setEditIdx(null)
  }

  function removeBullet(i: number) {
    if (savingProfile || bulletBusy) return
    void setBullets(profile.bullets.filter((_, j) => j !== i))
  }

  function moveBullet(i: number, dir: -1 | 1) {
    if (savingProfile || bulletBusy) return
    const j = i + dir
    if (j < 0 || j >= profile.bullets.length) return
    const next = profile.bullets.slice()
    const tmp = next[i]!
    next[i] = next[j]!
    next[j] = tmp
    void setBullets(next)
  }

  function onEditKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void commitEdit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditIdx(null)
      setBulletError('')
    }
  }

  // ----- resumes -----
  const resumes = useLiveQuery(
    () => db.files.where('kind').equals('resume').reverse().sortBy('uploadedAt'),
    [],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected: StoredFile | undefined =
    resumes?.find((r) => r.id === selectedId) ?? resumes?.[0]

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(selected.blob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selected])

  async function onResumeDrop(file: File) {
    const rec = await storeFile(file, 'resume')
    setSelectedId(rec.id)
  }

  async function onDeleteResume(r: StoredFile) {
    if (!confirmDialog(`Delete "${r.name}"? Applications linked to it will lose the link.`)) return
    await deleteFile(r.id)
    if (selectedId === r.id) setSelectedId(null)
  }

  const quickCopy = FIELDS.filter((f) => profile[f.key].trim() !== '')

  return (
    <div>
      <PageHeader title="Profile" subtitle="Details and resume lines you reuse across applications." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Profile</h2>
              <div className="flex items-center gap-2">
                {savedFlash && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
                <Button variant="primary" onClick={onSave} disabled={!dirty || savingProfile || bulletBusy}>
                  {savingProfile ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
            {profileError && <p role="alert" className="mb-3 text-sm text-red-400">{profileError}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input
                    type={f.type ?? 'text'}
                    value={profile[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>

            <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Quick copy</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Paste these into application forms.</p>
              {quickCopy.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Fill in a field above and it will appear here.</p>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {quickCopy.map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-500">{f.label}</div>
                        <div className="truncate text-sm">{profile[f.key]}</div>
                      </div>
                      <CopyButton text={profile[f.key]} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Reusable bullets</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Resume lines you paste into application forms.</p>
            {bulletError && <p role="alert" className="mt-3 text-sm text-red-400">{bulletError}</p>}

            {profile.bullets.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No bullets yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {profile.bullets.map((b, i) => (
                  <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-2 py-3">
                    <div className="row-span-2 flex flex-col">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Move up"
                        disabled={i === 0 || bulletBusy || savingProfile || editIdx !== null}
                        onClick={() => moveBullet(i, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Move down"
                        disabled={i === profile.bullets.length - 1 || bulletBusy || savingProfile || editIdx !== null}
                        onClick={() => moveBullet(i, 1)}
                      >
                        ↓
                      </Button>
                    </div>
                    <div className="min-w-0">
                      {editIdx === i ? (
                        <Textarea
                          autoFocus
                          aria-label={`Edit bullet ${i + 1}`}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={onEditKey}
                          className="min-h-24 resize-y leading-relaxed"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{b}</p>
                      )}
                    </div>
                    <div className="col-start-2 flex flex-wrap justify-end gap-1">
                      {editIdx === i ? (
                        <>
                          <Button variant="ghost" size="sm" disabled={bulletBusy || savingProfile} onClick={() => setEditIdx(null)}>Cancel</Button>
                          <Button variant="primary" size="sm" disabled={bulletBusy || savingProfile || !editDraft.trim()} onClick={() => void commitEdit()}>
                            {bulletBusy ? 'Saving…' : 'Save bullet'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <CopyButton text={b} />
                          <Button variant="ghost" size="sm" disabled={bulletBusy || savingProfile || editIdx !== null} onClick={() => startEdit(i)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 dark:text-red-400"
                            disabled={bulletBusy || savingProfile || editIdx !== null}
                            onClick={() => removeBullet(i)}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 space-y-2">
              <Textarea
                aria-label="New reusable bullet"
                value={newBullet}
                placeholder="Built a React dashboard used by 200 students..."
                onChange={(e) => setNewBullet(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void addBullet()
                  }
                }}
                className="min-h-20 resize-y leading-relaxed"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-xs text-zinc-500">Use Enter for a new line · Ctrl/⌘ + Enter to add</span>
                <Button variant="primary" className="shrink-0 whitespace-nowrap" onClick={() => void addBullet()} disabled={!newBullet.trim() || bulletBusy || savingProfile || editIdx !== null}>
                  {bulletBusy ? 'Saving…' : 'Add bullet'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div>
          <Card>
            <h2 className="text-base font-semibold">Resume</h2>
            <p className="mt-0.5 mb-3 text-sm text-zinc-500">Stored locally in the extension. Nothing is uploaded anywhere.</p>

            <FileDrop accept="application/pdf,.pdf" onFile={onResumeDrop} label="Drop a PDF resume here or click to browse" />

            {resumes && resumes.length > 0 && (
              <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {resumes.map((r) => {
                  const active = selected?.id === r.id
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className={active ? 'truncate text-sm font-medium' : 'truncate text-sm'}>{r.name}</div>
                        <div className="text-xs text-zinc-500">
                          {fmtSize(r.size)} · {fmtDate(r.uploadedAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" disabled={active} onClick={() => setSelectedId(r.id)}>
                          {active ? 'Previewing' : 'Preview'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => download(r.name, r.blob)}>
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 dark:text-red-400"
                          onClick={() => onDeleteResume(r)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {resumes && resumes.length === 0 && (
              <p className="mt-4 text-sm text-zinc-500">No resume stored yet.</p>
            )}

            {selected && previewUrl && (
              <div className="mt-4">
                {selected.mime === 'application/pdf' ? (
                  // A blob: URL renders fine inside a chrome-extension:// page; no CSP change needed.
                  <iframe src={previewUrl} className="h-[70vh] w-full rounded border" title="Resume preview" />
                ) : (
                  <p className="rounded border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
                    Preview is only available for PDF files. Use Download to open this one.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
