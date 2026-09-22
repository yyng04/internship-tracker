import { SOURCES, STATUSES, STATUS_LABELS, type Application, type Source, type Status } from '../types'
import { daysBetween } from './utils'

/** Statuses that count as the employer having responded to an application. */
const RESPONSE_STATUSES: readonly Status[] = ['oa', 'interview', 'offer', 'rejected']

/** Index of the first 'applied' entry in an app's history, or -1 when it was never applied. */
function appliedIndex(app: Application): number {
  return app.history.findIndex((h) => h.status === 'applied')
}

/** Index of the first response entry after the applied entry, or -1 when none. */
function firstResponseIndex(app: Application, from: number): number {
  for (let i = from + 1; i < app.history.length; i++) {
    if (RESPONSE_STATUSES.includes(app.history[i].status)) return i
  }
  return -1
}

/** Parse a yyyy-mm-dd string as a local-time Date at midnight. */
function localDate(iso: string): Date {
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
}

/** Local-time Monday 00:00 of the week containing the given date. */
function startOfIsoWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (out.getDay() + 6) % 7 // Monday = 0 ... Sunday = 6
  out.setDate(out.getDate() - dow)
  return out
}

/** Applications submitted per ISO week (Monday start) for the last N weeks, labelled by week start like "8 Sep". */
export function weeklyApplied(apps: Application[], weeks = 12): { week: string; count: number }[] {
  const thisMonday = startOfIsoWeek(new Date())
  const applied = apps
    .filter((a) => a.appliedAt)
    .map((a) => localDate(a.appliedAt as string).getTime())
  const rows: { week: string; count: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday)
    start.setDate(start.getDate() - i * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const s = start.getTime()
    const e = end.getTime()
    rows.push({
      week: start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      count: applied.filter((t) => t >= s && t < e).length,
    })
  }
  return rows
}

/** Number of applications that have ever passed through each status, in STATUSES order (a funnel, not current state). */
export function statusFunnel(apps: Application[]): { status: Status; label: string; count: number }[] {
  return STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: apps.filter((a) => a.history.some((h) => h.status === status) || a.status === status).length,
  }))
}

/** Number of applications currently at each status, in STATUSES order. */
export function currentDistribution(apps: Application[]): { status: Status; label: string; count: number }[] {
  return STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: apps.filter((a) => a.status === status).length,
  }))
}

/** Share of applied applications that later received any response (oa, interview, offer or rejected). */
export function responseRate(apps: Application[]): { applied: number; responded: number; rate: number } {
  let applied = 0
  let responded = 0
  for (const app of apps) {
    const i = appliedIndex(app)
    if (i < 0) continue
    applied++
    if (firstResponseIndex(app, i) >= 0) responded++
  }
  return { applied, responded, rate: applied === 0 ? 0 : responded / applied }
}

/** Mean days from the 'applied' history entry to the first later response entry; null when no application has responded. */
export function avgDaysToFirstResponse(apps: Application[]): number | null {
  const days: number[] = []
  for (const app of apps) {
    const i = appliedIndex(app)
    if (i < 0) continue
    const j = firstResponseIndex(app, i)
    if (j < 0) continue
    days.push(daysBetween(app.history[i].at, app.history[j].at))
  }
  if (days.length === 0) return null
  return days.reduce((sum, d) => sum + d, 0) / days.length
}

/** Number of applications per source, most used first; sources with no applications are omitted. */
export function bySource(apps: Application[]): { source: Source; count: number }[] {
  return SOURCES.map((source) => ({ source, count: apps.filter((a) => a.source === source).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
}
