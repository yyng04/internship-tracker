import type { Application, Profile } from '../../types'

/** "4 October 2026". */
export function letterDate(date = new Date()): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

/** "email | linkedin | phone", in the order the resume uses, skipping empty fields. */
export function contactLine(p: Profile): string {
  return [p.email, p.linkedin && bare(p.linkedin), p.phone, p.portfolio && bare(p.portfolio)]
    .filter(Boolean)
    .join(' | ')
}

/** "WuYuyang_CoverLetter_TikTok", matching the resume's file name pattern. */
export function letterFileName(p: Profile, app?: Application): string {
  const squash = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '')
  return [squash(p.fullName) || 'CoverLetter', p.fullName ? 'CoverLetter' : '', app?.company && squash(app.company)]
    .filter(Boolean)
    .join('_')
}
