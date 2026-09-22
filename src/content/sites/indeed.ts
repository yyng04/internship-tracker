import { text, type SiteExtractor } from './types'

export const indeed: SiteExtractor = {
  matches: (u) => u.hostname.includes('indeed.'),
  extract: () => ({
    source: 'other',
    title: text('[data-testid="jobsearch-JobInfoHeader-title"]') || text('h1.jobsearch-JobInfoHeader-title') || text('h1'),
    company: text('[data-testid="inlineHeader-companyName"]') || text('[data-company-name="true"]') || text('.jobsearch-InlineCompanyRating-companyHeader'),
    location: text('[data-testid="inlineHeader-companyLocation"]') || text('[data-testid="jobsearch-JobInfoHeader-companyLocation"]'),
  }),
}
