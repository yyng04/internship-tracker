import { db } from './schema'
import { todayISO } from '../lib/utils'
import type {
  Application,
  CoverLetter,
  Profile,
  Status,
  StoredFile,
  Template,
} from '../types'

const now = () => new Date().toISOString()
const uid = () => crypto.randomUUID()

// ---------- applications ----------

export type NewApplication = Omit<
  Application,
  'id' | 'history' | 'createdAt' | 'updatedAt' | 'notes' | 'tags'
> &
  Partial<Pick<Application, 'notes' | 'tags'>>

export async function addApplication(input: NewApplication): Promise<Application> {
  const ts = now()
  const app: Application = {
    notes: '',
    tags: [],
    ...input,
    id: uid(),
    history: [{ at: ts, status: input.status }],
    createdAt: ts,
    updatedAt: ts,
  }
  if (app.status === 'applied' && !app.appliedAt) app.appliedAt = todayISO()
  await db.applications.add(app)
  return app
}

export async function updateApplication(id: string, patch: Partial<Application>) {
  await db.applications.update(id, { ...patch, updatedAt: now() })
}

export async function setStatus(id: string, status: Status) {
  const app = await db.applications.get(id)
  if (!app || app.status === status) return
  const ts = now()
  const patch: Partial<Application> = {
    status,
    history: [...app.history, { at: ts, status }],
    updatedAt: ts,
  }
  if (status === 'applied' && !app.appliedAt) patch.appliedAt = todayISO()
  await db.applications.update(id, patch)
}

export async function deleteApplication(id: string) {
  await db.transaction('rw', db.applications, db.coverLetters, async () => {
    await db.coverLetters.where('applicationId').equals(id).modify({ applicationId: undefined })
    await db.applications.delete(id)
  })
}

// ---------- cover letters ----------

export async function addCoverLetter(
  input: Pick<CoverLetter, 'title' | 'body'> & Partial<Pick<CoverLetter, 'applicationId' | 'templateId'>>,
): Promise<CoverLetter> {
  const ts = now()
  const cl: CoverLetter = { ...input, id: uid(), createdAt: ts, updatedAt: ts }
  await db.coverLetters.add(cl)
  if (cl.applicationId) await assignCoverLetter(cl.id, cl.applicationId)
  return cl
}

/** Keep the application and letter links in sync when either side changes. */
export async function assignCoverLetter(letterId: string, applicationId?: string) {
  await db.transaction('rw', db.applications, db.coverLetters, async () => {
    const letter = await db.coverLetters.get(letterId)
    if (!letter) throw new Error('Cover letter not found')
    const ts = now()

    await db.applications.where('coverLetterId').equals(letterId).modify({ coverLetterId: undefined, updatedAt: ts })

    if (applicationId) {
      const application = await db.applications.get(applicationId)
      if (!application) throw new Error('Application not found')
      if (application.coverLetterId && application.coverLetterId !== letterId) {
        const oldLetter = await db.coverLetters.get(application.coverLetterId)
        if (oldLetter?.applicationId === applicationId) {
          await db.coverLetters.update(oldLetter.id, { applicationId: undefined, updatedAt: ts })
        }
      }
      await db.applications.update(applicationId, { coverLetterId: letterId, updatedAt: ts })
    }
    await db.coverLetters.update(letterId, { applicationId, updatedAt: ts })
  })
}

export async function unlinkApplicationCoverLetter(applicationId: string) {
  const application = await db.applications.get(applicationId)
  if (!application?.coverLetterId) return
  const letter = await db.coverLetters.get(application.coverLetterId)
  if (letter) await assignCoverLetter(letter.id)
  else {
    await db.applications.update(applicationId, { coverLetterId: undefined, updatedAt: now() })
    }
}

export async function updateCoverLetter(id: string, patch: Partial<CoverLetter>) {
  await db.coverLetters.update(id, { ...patch, updatedAt: now() })
}

export async function deleteCoverLetter(id: string) {
  await db.transaction('rw', db.applications, db.coverLetters, async () => {
    await db.applications.where('coverLetterId').equals(id).modify({ coverLetterId: undefined })
    await db.coverLetters.delete(id)
  })
}

// ---------- templates ----------

export async function addTemplate(input: Pick<Template, 'name' | 'body'>): Promise<Template> {
  const ts = now()
  const t: Template = { ...input, id: uid(), createdAt: ts, updatedAt: ts }
  await db.templates.add(t)
  return t
}

export async function updateTemplate(id: string, patch: Partial<Template>) {
  await db.templates.update(id, { ...patch, updatedAt: now() })
}

export async function deleteTemplate(id: string) {
  await db.templates.delete(id)
}

/** Replace {company}, {role}, {date}, {name} and any profile field in a template body. */
export function renderTemplate(
  body: string,
  vars: Record<string, string | undefined>,
): string {
  // Empty values keep the placeholder visible so the user notices what is missing.
  return body.replace(/\{(\w+)\}/g, (m, key: string) => vars[key] || m)
}

// ---------- profile ----------

export const EMPTY_PROFILE: Profile = {
  id: 'me',
  fullName: '',
  email: '',
  phone: '',
  linkedin: '',
  github: '',
  portfolio: '',
  school: '',
  gradYear: '',
  bullets: [],
}

export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('me')) ?? EMPTY_PROFILE
}

export async function saveProfile(p: Profile) {
  await db.profile.put({ ...p, id: 'me' })
}

// ---------- files ----------

export async function storeFile(file: File, kind: StoredFile['kind']): Promise<StoredFile> {
  const rec: StoredFile = {
    id: uid(),
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    kind,
    uploadedAt: now(),
  }
  await db.files.add(rec)
  return rec
}

export async function deleteFile(id: string) {
  await db.transaction('rw', db.applications, db.files, async () => {
    await db.applications.where('resumeFileId').equals(id).modify({ resumeFileId: undefined })
    await db.files.delete(id)
  })
}

// ---------- backup ----------

interface Backup {
  version: 1
  exportedAt: string
  applications: Application[]
  coverLetters: CoverLetter[]
  templates: Template[]
  profile: Profile | null
  files: (Omit<StoredFile, 'blob'> & { data: string })[] // base64
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let s = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function exportBackup(): Promise<Backup> {
  const files = await db.files.toArray()
  return {
    version: 1,
    exportedAt: now(),
    applications: await db.applications.toArray(),
    coverLetters: await db.coverLetters.toArray(),
    templates: await db.templates.toArray(),
    profile: (await db.profile.get('me')) ?? null,
    files: await Promise.all(
      files.map(async ({ blob, ...rest }) => ({ ...rest, data: await blobToBase64(blob) })),
    ),
  }
}

export function isBackup(raw: unknown): raw is Backup {
  const b = raw as Backup
  return Boolean(
    b && b.version === 1 &&
    Array.isArray(b.applications) && Array.isArray(b.coverLetters) &&
    Array.isArray(b.templates) && Array.isArray(b.files) &&
    (b.profile === null || (b.profile && typeof b.profile === 'object')),
  )
}

export async function importBackup(raw: unknown, mode: 'replace' | 'merge') {
  if (!isBackup(raw)) {
    throw new Error('Not a valid Internship Tracker backup file')
  }
  const b = raw
  await db.transaction(
    'rw',
    [db.applications, db.coverLetters, db.templates, db.profile, db.files],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.applications.clear(),
          db.coverLetters.clear(),
          db.templates.clear(),
          db.profile.clear(),
          db.files.clear(),
        ])
      }
      await db.applications.bulkPut(b.applications)
      await db.coverLetters.bulkPut(b.coverLetters ?? [])
      await db.templates.bulkPut(b.templates ?? [])
      if (b.profile) await db.profile.put(b.profile)
      await db.files.bulkPut(
        (b.files ?? []).map(({ data, ...rest }) => ({ ...rest, blob: base64ToBlob(data, rest.mime) })),
      )
    },
  )
}

export async function wipeAll() {
  await db.delete()
  await db.open()
}

export function applicationsToCsv(apps: Application[]): string {
  const cols: (keyof Application)[] = [
    'company', 'role', 'location', 'status', 'source', 'appliedAt', 'deadline',
    'followUpAt', 'salary', 'url', 'tags', 'notes', 'createdAt', 'updatedAt',
  ]
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...apps.map((a) => cols.map((c) => esc(a[c])).join(','))].join('\n')
}
