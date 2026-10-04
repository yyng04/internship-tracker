import { forwardRef, useMemo } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import type { Application, Profile } from '../../types'
import { contactLine, letterDate } from './format'
import './letter.css'

interface Props {
  body: string
  profile: Profile
  application?: Application
  date?: Date
}

/** One A4 cover letter: header from the profile, recipient from the application, then the body. */
export const LetterPage = forwardRef<HTMLDivElement, Props>(function LetterPage(
  { body, profile, application, date },
  ref,
) {
  const html = useMemo(() => renderMarkdown(body), [body])
  const contact = contactLine(profile)
  const recipient = application ? [application.company, application.location].filter(Boolean) : []

  return (
    <div ref={ref} className="lp-page">
      <h1 className={profile.fullName ? 'lp-name' : 'lp-name is-empty'}>{profile.fullName || 'Your name'}</h1>
      {profile.headline && <div className="lp-headline">{profile.headline}</div>}
      <div className="lp-contact">{contact || ' '}</div>

      <div className="lp-date">{letterDate(date)}</div>
      {recipient.length > 0 && (
        <div className="lp-recipient">
          <div>Hiring Team</div>
          {recipient.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
      {application?.role && <div className="lp-re">Re: {application.role}</div>}

      <div className="lp-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
})
