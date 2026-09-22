import Dexie, { type EntityTable } from 'dexie'
import type { Application, CoverLetter, Profile, Settings, StoredFile, Template } from '../types'

export class TrackerDB extends Dexie {
  applications!: EntityTable<Application, 'id'>
  coverLetters!: EntityTable<CoverLetter, 'id'>
  templates!: EntityTable<Template, 'id'>
  profile!: EntityTable<Profile, 'id'>
  files!: EntityTable<StoredFile, 'id'>
  settings!: EntityTable<Settings, 'id'>

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
  }
}

export const db = new TrackerDB()
