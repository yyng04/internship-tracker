import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/schema'
import {
  DEFAULT_SETTINGS,
  applicationsToCsv,
  exportBackup,
  getSettings,
  importBackup,
  saveSettings,
  wipeAll,
} from '../../db/repo'
import { download, todayISO } from '../../lib/utils'
import type { Settings as SettingsRow } from '../../types'
import { Button, Card, Field, Input, Modal, PageHeader, Select, confirmDialog } from '../components/ui'

const HOURS = Array.from({ length: 24 }, (_, h) => h)

type Notice = { kind: 'ok' | 'error'; text: string } | null

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <p className={notice.kind === 'ok' ? 'mt-2 text-sm text-green-700 dark:text-green-400' : 'mt-2 text-sm text-red-600 dark:text-red-400'}>
      {notice.text}
    </p>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold">{children}</h2>
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Read the record counts out of a parsed backup without trusting its shape. */
function backupCounts(raw: unknown) {
  const b = (raw ?? {}) as Record<string, unknown>
  const len = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).length : 0)
  return {
    applications: len('applications'),
    letters: len('coverLetters'),
    templates: len('templates'),
    files: len('files'),
  }
}

// ---------- Reminders ----------

function RemindersCard() {
  const [s, setS] = useState<SettingsRow>(DEFAULT_SETTINGS)
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => {
    getSettings().then(setS)
  }, [])

  async function patch(p: Partial<SettingsRow>) {
    const next = { ...s, ...p }
    setS(next)
    await saveSettings(p)
  }

  async function testNotification() {
    setNotice(null)
    try {
      await chrome.runtime.sendMessage({ type: 'DATA_CHANGED' })
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Internship Tracker',
        message: 'Test notification. Reminders will look like this.',
      })
      setNotice({ kind: 'ok', text: 'Notification sent.' })
    } catch (e) {
      setNotice({
        kind: 'error',
        text: `Could not show a notification: ${errMsg(e)}. This only works when the dashboard is opened from the extension.`,
      })
    }
  }

  return (
    <Card>
      <SectionTitle>Reminders</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Daily check time">
          <Select value={s.reminderHour} onChange={(e) => patch({ reminderHour: Number(e.target.value) })}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-600"
            checked={s.notificationsEnabled}
            onChange={(e) => patch({ notificationsEnabled: e.target.checked })}
          />
          Show notifications
        </label>
      </div>
      <p className="mt-3 text-sm text-zinc-500">
        Once a day at this time the extension checks for follow-ups and deadlines that are due, updates the toolbar
        badge, and shows one notification.
      </p>
      <div className="mt-3">
        <Button onClick={testNotification}>Test notification</Button>
      </div>
      <NoticeLine notice={notice} />
    </Card>
  )
}

// ---------- Backup ----------

function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  async function exportJson() {
    setNotice(null)
    try {
      const b = await exportBackup()
      download(`internship-tracker-backup-${todayISO()}.json`, JSON.stringify(b, null, 2), 'application/json')
    } catch (e) {
      setNotice({ kind: 'error', text: `Export failed: ${errMsg(e)}` })
    }
  }

  async function exportCsv() {
    setNotice(null)
    try {
      const csv = applicationsToCsv(await db.applications.toArray())
      download(`internship-tracker-applications-${todayISO()}.csv`, csv, 'text/csv')
    } catch (e) {
      setNotice({ kind: 'error', text: `Export failed: ${errMsg(e)}` })
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNotice(null)
    try {
      setPending(JSON.parse(await file.text()))
    } catch (err) {
      setNotice({ kind: 'error', text: `Could not read that file as JSON: ${errMsg(err)}` })
    }
  }

  async function runImport(mode: 'replace' | 'merge') {
    setBusy(true)
    try {
      await importBackup(pending, mode)
      const c = backupCounts(pending)
      setNotice({
        kind: 'ok',
        text: `Imported ${c.applications} applications, ${c.letters} cover letters, ${c.templates} templates and ${c.files} files (${mode}).`,
      })
      setPending(null)
    } catch (err) {
      setNotice({ kind: 'error', text: `Import failed: ${errMsg(err)}` })
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const counts = pending ? backupCounts(pending) : null

  return (
    <Card>
      <SectionTitle>Backup</SectionTitle>
      <p className="mb-3 text-sm text-zinc-500">
        The JSON backup contains everything, including uploaded files, and can be imported again here. The CSV is a
        flat list of applications for spreadsheets.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={exportJson}>
          Export everything (.json)
        </Button>
        <Button onClick={exportCsv}>Export applications (.csv)</Button>
        <Button onClick={() => fileRef.current?.click()}>Import backup</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
      </div>
      <NoticeLine notice={notice} />

      <Modal open={pending !== null} onClose={() => !busy && setPending(null)} title="Import backup">
        {counts && (
          <>
            <p className="text-sm">This file contains:</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <li>{counts.applications} applications</li>
              <li>{counts.letters} cover letters</li>
              <li>{counts.templates} templates</li>
              <li>{counts.files} files</li>
            </ul>
            <div className="mt-4 space-y-3">
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Replace everything</div>
                    <div className="text-xs text-zinc-500">
                      Clears all current data first, then loads the backup. Use this to restore a snapshot exactly.
                    </div>
                  </div>
                  <Button variant="danger" disabled={busy} onClick={() => runImport('replace')}>
                    Replace
                  </Button>
                </div>
              </div>
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Merge</div>
                    <div className="text-xs text-zinc-500">
                      Keeps current data and adds records from the backup. Records with the same id are overwritten by
                      the backup copy.
                    </div>
                  </div>
                  <Button variant="primary" disabled={busy} onClick={() => runImport('merge')}>
                    Merge
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Modal>
    </Card>
  )
}

// ---------- Danger zone ----------

function DangerCard() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  function start() {
    setNotice(null)
    if (
      confirmDialog(
        'This removes every application, cover letter, template, file, profile and setting from this browser. It cannot be undone. Continue?',
      )
    ) {
      setTyped('')
      setOpen(true)
    }
  }

  async function wipe() {
    setBusy(true)
    try {
      await wipeAll()
      setOpen(false)
      setNotice({ kind: 'ok', text: 'All data deleted.' })
    } catch (e) {
      setNotice({ kind: 'error', text: `Delete failed: ${errMsg(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-red-200 dark:border-red-900">
      <SectionTitle>Danger zone</SectionTitle>
      <p className="mb-3 text-sm text-zinc-500">
        Deletes everything stored by this extension. Export a backup first if there is any chance you will want
        it back.
      </p>
      <Button variant="danger" onClick={start}>
        Delete all data
      </Button>
      <NoticeLine notice={notice} />

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Delete all data">
        <p className="text-sm">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm. This cannot be undone.
        </p>
        <div className="mt-3">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoFocus />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy || typed !== 'DELETE'} onClick={wipe}>
            Delete everything
          </Button>
        </div>
      </Modal>
    </Card>
  )
}

// ---------- About ----------

function readVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return 'dev'
  }
}

function AboutCard() {
  return (
    <Card>
      <SectionTitle>About</SectionTitle>
      <p className="text-sm">Internship Tracker, version {readVersion()}</p>
      <p className="mt-1 text-sm text-zinc-500">
        All data stays in this browser profile and is removed if the extension is uninstalled.
      </p>
      <a
        className="mt-2 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        href="https://github.com/yyng04/internship-tracker"
        target="_blank"
        rel="noreferrer"
      >
        github.com/yyng04/internship-tracker
      </a>
    </Card>
  )
}

export function Settings() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-2xl space-y-4">
        <RemindersCard />
        <BackupCard />
        <DangerCard />
        <AboutCard />
      </div>
    </>
  )
}
