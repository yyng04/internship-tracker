# Internship Tracker

A Chrome and Brave extension for tracking internship applications, cover letters and your resume. Everything is stored locally in the browser (IndexedDB); nothing is sent anywhere.

## Features

- Board of applications by status (wishlist, applied, OA, interview, offer, rejected, withdrawn), with a table view
- One-click capture from LinkedIn, Indeed, Glassdoor and most company career pages
- Cover letter templates with `{company}`, `{role}`, `{date}` and `{name}` placeholders
- Profile page with resume upload, preview and reusable resume bullets
- Follow-up and deadline reminders: toolbar badge count and a daily notification
- Stats: applications per week, status funnel, response rate
- Full JSON backup and restore, CSV export

## Install (Chrome or Brave)

1. `npm install`
2. `npm run build` (output in `dist/`)
3. Open `chrome://extensions` (or `brave://extensions`), turn on Developer mode
4. Click Load unpacked and pick the `dist/` folder
5. Pin the extension. `Alt+Shift+I` opens the dashboard.

## Develop

```
npm run dev
```

Load `dist/` as above; the page reloads when you save. Built with Vite, React, TypeScript, Tailwind, Dexie and CRXJS.
