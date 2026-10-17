# Chrome Web Store Listing — Proto Simplifier

> Last Updated: 2026-10-17

## Store Listing

**Extension Name**
Proto Simplifier

**Short Description**
<!-- Max 132 characters -->
Simplifies .proto files on GitHub by hiding annotation clutter so you can read the actual schema.

**Detailed Description**
<!-- Max 16,000 characters -->
Proto Simplifier adds a Simplify button next to the Raw button on any .proto file view on GitHub. Click it to see the file with annotation and option noise stripped away, so the real structure of your messages and fields is easy to read.

Protocol Buffer files are often covered in verbose annotations for API documentation, validation rules, and code generation. These are useful to tools but make the schema hard to read at a glance. Proto Simplifier hides that noise on demand, without changing the file on GitHub.

Key features: a simplified, syntax-highlighted view of the file with the original line numbers preserved in a gutter, so you can always map a simplified line back to its real position in the file. Settings let you choose whether to keep comments, keep specific annotations by name, and whether removed lines leave a blank space or are compacted away. Your choices are remembered across browsing sessions.

To use it: open any .proto file on GitHub, click Simplify next to the Raw button, and click again to return to the normal view. Open the extension icon to adjust what gets kept or removed.

This extension only reads the file you are actively viewing on GitHub to build the simplified view. It does not track your browsing, collect analytics, or send your data anywhere other than GitHub itself (to fetch the file content for very large files). Your settings are stored in your Chrome profile.

Found a bug or have a feature request? Open an issue on the project's GitHub repository.

**Category**
Developer Tools

**Single Purpose**
Simplifies Protocol Buffer (.proto) files on GitHub by hiding annotation and comment noise on demand.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | 🟡 Needs update | icons/128.png |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile | 440×280 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: A .proto file on GitHub before clicking Simplify (showing the annotation clutter) side-by-side or paired with the same file after clicking Simplify.
- Screenshot 2: The simplified view close-up, showing syntax highlighting and the original-line-number gutter.
- Screenshot 3: The settings popup (keep comments / keep annotations / compact toggle).

`icons/16.png`, `icons/48.png`, `icons/128.png` are placeholder icons generated programmatically (a simple colored "lines" glyph). They are real, correctly-sized PNG files and work for development and submission, but should be replaced with real artwork before a public launch — note the 🟡 status above.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Saves the user's Simplify preferences (keep comments, keep annotations list, compact vs. preserve blank lines) in their Chrome profile, so choices persist across browsing sessions. |
| `https://github.com/*` | host_permissions | Reads the .proto file currently open in the tab (via GitHub's own page data, or by fetching the file's "raw" URL on github.com for very large files) so the extension can build and display the simplified view. The extension only acts on .proto file pages. |
| `https://*.githubusercontent.com/*` | host_permissions | Fetches the raw file contents from GitHub's content-delivery subdomain as a fallback when a file is too large for GitHub to embed in the page directly. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

No data is collected, transmitted to the developer, or shared with any third party. The extension reads the currently-open GitHub file (already visible to the user in their browser) purely to render the simplified view locally in that tab, and stores the user's display preferences locally via `chrome.storage.sync` (synced by the user's own Google account, not to the developer).

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Website content | Read only, not stored | No (only to github.com/githubusercontent.com to fetch the file itself, which the browser already does) | Render the simplified view of the .proto file | No |
| User activity | No | No | — | No |
| All other categories | No | No | — | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED — not yet set]
<!-- Host the policy text below at a public URL (GitHub Pages, a gist, etc.) before submitting. -->

Suggested policy text (see draft below) — host at e.g. `https://<username>.github.io/proto-simplifier/privacy` or a GitHub Gist, then paste the URL here.

---
**Privacy Policy — Proto Simplifier**

Last updated: 2026-10-17

Proto Simplifier does not collect, store, or transmit any personal data or browsing history to the developer or any third party.

The extension reads the content of `.proto` files you view on github.com, solely to display a simplified version of that file within your browser tab. For very large files, the extension fetches the file's raw contents directly from github.com or githubusercontent.com — the same request your browser would make anyway to show you the file.

Your display preferences (whether to keep comments, which annotations to keep, and whether to compact blank lines) are stored using Chrome's built-in `storage` API. If you are signed into Chrome, this is synced by Google across your own devices like any other browser setting — it is never sent to the developer.

This extension does not use cookies, analytics, or any third-party services.

Contact: [your email or GitHub issues URL]
---

## Distribution

**Visibility**: Unlisted (recommended for a niche developer tool) / Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED — fill in]

**Contact Email** [REQUIRED — fill in]

**Support URL / Email**
GitHub Issues page for this repository (once pushed to a GitHub remote)

**Homepage URL**
GitHub repository URL (once pushed to a GitHub remote)

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-10-17 | Initial build: Simplify button on GitHub .proto blob pages, strips option/annotation noise and comments by default, syntax highlighting, original-line-number gutter, settings popup (keep comments / keep annotations / compact toggle), sticky-header overlap fix. | Draft |

## Review Notes

### Known Issues / Limitations
- Icons are placeholder graphics (see Graphics & Assets table) — fine for submission, worth upgrading before a public push.
- Scope is single-file (`blob`) view only; diff/PR views are not supported.
- Relies on GitHub's current DOM structure (`#repos-sticky-header`, `data-testid="raw-button"`, embedded `react-app.embeddedData` JSON) to inject the button and read file content. If GitHub changes this structure, the button may stop appearing until updated.
- No screenshots or privacy policy URL are finalized yet — both are required before submission (see tables above).

### Rejection History
<!-- None yet -->
