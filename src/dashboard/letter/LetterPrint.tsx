import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getProfile } from '../../db/repo'
import { letterFileName } from './format'
import { LetterPage } from './LetterPage'

/**
 * A cover letter alone on a white A4 page, opened in its own tab. It opens the print
 * dialog once loaded, where "Save as PDF" produces the file.
 */
export function LetterPrint() {
  const { id = '' } = useParams()
  const letter = useLiveQuery(() => db.coverLetters.get(id).then((l) => l ?? null), [id])
  const application = useLiveQuery(
    () => (letter?.applicationId ? db.applications.get(letter.applicationId) : undefined),
    [letter?.applicationId],
  )
  const profile = useLiveQuery(() => getProfile(), [])
  const printed = useRef(false)

  // The dashboard is dark; paper is white.
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')
    document.body.style.background = '#fff'
  }, [])

  const ready = Boolean(letter && profile && (!letter.applicationId || application))

  // Chrome uses the page title as the PDF's default file name.
  useEffect(() => {
    if (ready && profile) document.title = letterFileName(profile, application)
  }, [ready, profile, application])

  // Depends on `ready` alone, so a later re-render cannot cancel or repeat the dialog.
  useEffect(() => {
    if (!ready || printed.current) return
    printed.current = true
    setTimeout(() => window.print(), 300)
  }, [ready])

  if (letter === null) return <p style={{ padding: 24, color: '#333' }}>This letter no longer exists.</p>
  if (!ready || !letter || !profile) return null

  return (
    <div className="lp-print-screen">
      <style>{'@page { size: A4; margin: 0; }'}</style>
      <div className="lp-toolbar">
        <span>In the print dialog, set the destination to Save as PDF.</span>
        <button type="button" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      <LetterPage body={letter.body} profile={profile} application={application ?? undefined} />
    </div>
  )
}
