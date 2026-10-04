import { describe, findDescriptionRoot } from './description'
import { generic } from './sites/generic'
import { glassdoor } from './sites/glassdoor'
import { indeed } from './sites/indeed'
import { linkedin } from './sites/linkedin'
import { tiktok } from './sites/tiktok'
import type { SiteExtractor } from './sites/types'
import type { CapturedJob, JobDescription, Message } from '../types'

const extractors = [linkedin, indeed, glassdoor, tiktok, generic]

/** Try the site's own container, then JSON-LD, then a search by section headings. */
function readDescription(ex: SiteExtractor): JobDescription | undefined {
  const finders = [
    () => ex.descriptionRoot?.() ?? null,
    () => generic.descriptionRoot?.() ?? null,
    () => findDescriptionRoot(document),
  ]
  for (const find of finders) {
    try {
      const root = find()
      const found = root ? describe(root) : undefined
      if (found) return found
    } catch {
      // a broken finder must not stop the rest of the capture
    }
  }
  return undefined
}

function capture(): CapturedJob {
  const url = new URL(location.href)
  const ex = extractors.find((e) => e.matches(url)) ?? generic
  const partial = ex.extract()
  // Strip tracking params from LinkedIn/Indeed URLs so the saved link is stable.
  for (const k of [...url.searchParams.keys()]) {
    if (/^(utm_|ref|refId|trk|tracking|from|src)/i.test(k)) url.searchParams.delete(k)
  }
  return {
    title: partial.title ?? '',
    company: partial.company ?? '',
    location: partial.location ?? '',
    source: partial.source ?? 'other',
    url: url.toString(),
    description: readDescription(ex),
  }
}

// The popup injects this script each time it opens, so register the listener once per page.
const flag = '__internshipTrackerCapture'
const scope = globalThis as typeof globalThis & { [flag]?: boolean }
if (!scope[flag]) {
  scope[flag] = true
  chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    if (msg?.type === 'CAPTURE_JOB') sendResponse(capture())
    return false
  })
}
