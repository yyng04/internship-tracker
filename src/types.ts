export const STATUSES = [
  'wishlist',
  'applied',
  'oa',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const

export type Status = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  oa: 'Online Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export const SOURCES = ['linkedin', 'indeed', 'glassdoor', 'company', 'referral', 'other'] as const
export type Source = (typeof SOURCES)[number]

export interface StatusChange {
  at: string // ISO date-time
  status: Status
}

export interface Application {
  id: string
  company: string
  role: string
  location: string
  url: string
  source: Source
  status: Status
  appliedAt?: string // ISO date (yyyy-mm-dd)
  deadline?: string
  followUpAt?: string
  salary?: string
  notes: string
  coverLetterId?: string
  resumeFileId?: string
  tags: string[]
  history: StatusChange[]
  createdAt: string
  updatedAt: string
}

export interface CoverLetter {
  id: string
  applicationId?: string
  templateId?: string
  title: string
  body: string // markdown
  createdAt: string
  updatedAt: string
}

export interface Template {
  id: string
  name: string
  body: string // markdown with {company} {role} {date} {name} placeholders
  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: 'me' // singleton row
  fullName: string
  email: string
  phone: string
  linkedin: string
  github: string
  portfolio: string
  school: string
  gradYear: string
  bullets: string[] // reusable resume lines to paste into forms
}

export interface StoredFile {
  id: string
  name: string
  mime: string
  size: number
  blob: Blob
  kind: 'resume' | 'other'
  uploadedAt: string
}

export interface Settings {
  id: 'settings'
  reminderHour: number // 0 to 23, local time
  notificationsEnabled: boolean
}

/** Shape the content script returns when the popup asks it to read a job page. */
export interface CapturedJob {
  title: string
  company: string
  url: string
  location: string
  source: Source
}

/** Messages passed between popup, dashboard, background and content scripts. */
export type Message =
  | { type: 'CAPTURE_JOB' }
  | { type: 'DATA_CHANGED' }
  | { type: 'OPEN_DASHBOARD'; hash?: string }
