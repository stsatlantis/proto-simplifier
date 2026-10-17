# Proto Simplifier

A Chrome extension (Manifest V3) that adds a **Simplify** button to GitHub
`.proto` file views. Clicking it strips annotation/option noise and comments so
the real structure — messages, fields, types, field numbers — is easy to read.
Click again to restore the original view.

## What "simplify" does

By default it:

- Removes annotation-style options: `option (google.api...) = { ... };` (including
  multi-line bodies). **Standard** options like `option go_package = "..."` are
  kept.
- Removes field option blocks: `field = 1 [ (grpc...) = {...} ]` → `field = 1;`.
- Removes all comments (`// ...` trailing and standalone, and `/* ... */`).
- Realigns closing braces to their opener and tidies the leftover whitespace.

The simplified view is **syntax-highlighted** (keywords, builtin scalar types,
numbers, strings) and shows an **original-file line-number gutter**, so you can
map every kept line back to where it lives in the real file. Because stripped
lines are gone, those numbers are intentionally non-contiguous (e.g. `1, 11, 18`).
Highlight colors reuse GitHub's own theme variables, so they match the active
light/dark theme; line numbers are not selectable, so copy-paste stays clean.

### Example

Before:

```proto
message ActiveTimeframe {
  string start_time = 1 [(grpc...openapiv3_field) = {description: "Start time."}]; // Timeframe start time...
  string end_time = 2 [(grpc...openapiv3_field) = {description: "End time."}]; // Timeframe end time...
}
```

After:

```proto
message ActiveTimeframe {
  string start_time = 1;
  string end_time = 2;
}
```

See `test.md` for the authoritative input→output baseline.

## Options

Click the extension's toolbar icon to open the settings popup. Settings are saved
to `chrome.storage.sync` and applied the next time you Simplify (if the view is
already open, it re-renders automatically):

- **Keep comments** — leave `//` and `/* */` comments in place instead of
  stripping them.
- **Keep blank lines where removed content was** — leave a blank line in place of
  each removed comment/annotation line instead of collapsing the gap (compact is
  the default).
- **Keep these annotations** — a list (one per line) of annotation names to keep.
  Matching is by full name or trailing name, so `field_behavior` keeps
  `google.api.field_behavior`, and a field block keeps only its matching entries
  (e.g. `[(field_behavior) = REQUIRED, (openapiv3_field) = {...}]` →
  `[(google.api.field_behavior) = REQUIRED]`). Everything else is still stripped.

## Project layout

```
proto-simplifier/
  manifest.json          # MV3 manifest
  popup.html / popup.js  # settings popup (keep comments / annotations / blank lines)
  src/
    simplify.js          # options-driven transform + line-number mapping + tokenizer (no DOM), unit-tested
    content.js           # detect proto blob, inject button, fetch content, render highlighted/numbered view
    service-worker.js    # allowlisted raw-file fetch proxy (fallback for large files)
  styles/panel.css       # styles for the injected simplified view (shadow DOM)
  icons/                 # 16/48/128 placeholder icons — replace before publishing
  test/simplify.test.js  # node --test
  test.md                # baseline examples
```

## Develop & load

1. Clone/open this folder.
2. Open `chrome://extensions`, enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `proto-simplifier/` directory.
4. Open any GitHub `.proto` file (e.g.
   `https://github.com/googleapis/googleapis/blob/master/google/api/annotations.proto`)
   and click **Simplify** next to the **Raw** button.

After editing files, click the **reload** icon on the extension card. Use the
card's **Errors** / service-worker **Inspect** links for debugging.

## Tests

The transform is a dependency-free pure module, tested with Node's built-in
runner:

```
cd proto-simplifier
node --test
```

(Run from the project root so the relative `require("../src/simplify.js")`
resolves. `node --test test/simplify.test.js` works too.)

## How it gets file content

GitHub's code view is virtualized (only visible lines are in the DOM), so the
content script never scrapes the DOM. It reads the full file from the inlined
`react-app.embeddedData` JSON (`rawLines`) — zero network, works for private
repos. For large/truncated files it falls back to fetching the raw URL through
the service worker (which only fetches allowlisted `*.githubusercontent.com` /
`github.com/.../raw/...` URLs with credentials).

## Notes

- The icons in `icons/` are generated placeholders. Replace them with real
  artwork before any Web Store submission.
- Scope is the single-file (blob) view. Diff/PR views are a possible future
  enhancement.
```
