import Dexie, { type EntityTable } from 'dexie'
import type { Application, CoverLetter, Profile, StoredFile, Template } from '../types'

export class TrackerDB extends Dexie {
  applications!: EntityTable<Application, 'id'>
  coverLetters!: EntityTable<CoverLetter, 'id'>
  templates!: EntityTable<Template, 'id'>
  profile!: EntityTable<Profile, 'id'>
  files!: EntityTable<StoredFile, 'id'>

  constructor() {
    super('internship-tracker')
    // Only indexed fields are listed; the whole object is stored regardless.
    this.version(1).stores({
      applications: 'id, company, status, url, appliedAt, deadline, followUpAt, updatedAt, coverLetterId, resumeFileId, *tags',
      coverLetters: 'id, applicationId, templateId, updatedAt',
      templates: 'id, name, updatedAt',
      profile: 'id',
      files: 'id, kind, uploadedAt',
      settings: 'id',
    })

    // Version 2 drops the settings store, which only held reminder options, and
    // clears the old "Unspecified company" sentinel now that a blank company is
    // stored empty and rendered through companyLabel.
    this.version(2)
      .stores({ settings: null })
      .upgrade((tx) =>
        tx
          .table('applications')
          .toCollection()
          .modify((app: Application) => {
            if (app.company === 'Unspecified company') app.company = ''
          }),
      )
  }
}

export const db = new TrackerDB()
