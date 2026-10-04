import { first, text, type SiteExtractor } from './types'

export const linkedin: SiteExtractor = {
  matches: (u) => u.hostname.endsWith('linkedin.com'),
  extract: () => ({
    source: 'linkedin',
    title:
      text('.job-details-jobs-unified-top-card__job-title') ||
      text('.jobs-unified-top-card__job-title') ||
      text('.top-card-layout__title') ||
      text('h1'),
    company:
      text('.job-details-jobs-unified-top-card__company-name') ||
      text('.jobs-unified-top-card__company-name') ||
      text('.topcard__org-name-link') ||
      text('a[data-tracking-control-name="public_jobs_topcard-org-name"]'),
    location:
      text('.job-details-jobs-unified-top-card__bullet') ||
      text('.jobs-unified-top-card__bullet') ||
      text('.topcard__flavor--bullet'),
  }),
  descriptionRoot: () =>
    first('.jobs-description__content', '.jobs-box__html-content', '#job-details', '.show-more-less-html__markup', '.description__text'),
}
