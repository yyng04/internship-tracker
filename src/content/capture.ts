import { generic } from './sites/generic'
import { glassdoor } from './sites/glassdoor'
import { indeed } from './sites/indeed'
import { linkedin } from './sites/linkedin'
import type { CapturedJob, Message } from '../types'

const extractors = [linkedin, indeed, glassdoor, generic]

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
  }
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg?.type === 'CAPTURE_JOB') {
    sendResponse(capture())
  }
  return false
})
