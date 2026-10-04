import { fmtDate } from '../../lib/utils'
import type { JobDescription } from '../../types'

const SECTIONS = [
  ['responsibilities', 'Responsibilities'],
  ['requirements', 'Requirements'],
  ['preferred', 'Preferred'],
] as const

/** The responsibilities, requirements and full text saved from a listing. */
export function ListingDetails({ description, compact }: { description?: JobDescription; compact?: boolean }) {
  if (!description) {
    return (
      <p className="text-sm text-zinc-500">
        No listing text saved. Open the listing in a tab and click the extension icon to save it here.
      </p>
    )
  }

  const shown = SECTIONS.filter(([key]) => description[key].length > 0)
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {shown.map(([key, label]) => (
        <section key={key}>
          <h3 className="mb-1 text-sm font-semibold">{label}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-zinc-800 dark:text-zinc-200">
            {description[key].map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      {shown.length === 0 && (
        <p className="text-sm text-zinc-500">The listing had no recognisable sections. The full text is below.</p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500 select-none">
          Full listing text, saved {fmtDate(description.capturedAt)}
        </summary>
        <pre className="mt-2 max-h-96 overflow-y-auto font-sans text-xs leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {description.text}
        </pre>
      </details>
    </div>
  )
}
