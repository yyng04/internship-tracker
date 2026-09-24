# Local preview

Runs the popup and dashboard in an ordinary browser tab, without installing the
extension. Useful for checking layout and flows while developing.

    npm run preview

That builds the extension, refreshes `preview/app` from `dist`, and serves the
preview at http://localhost:8767.

The preview seeds its own sample applications, cover letter, templates, profile
and resume. Its database belongs to the preview address and is entirely separate
from the extension installed in your browser, so nothing here touches real data.

Browser APIs are mocked in `preview-mock.js`: page capture always returns the
same sample job, and anything requiring a real extension context is unavailable.

`preview/app` is generated and ignored by git. The files kept in version control
are `index.html`, `preview.js`, `preview-mock.js`, `build-preview.mjs` and
`sample-resume.pdf`.
