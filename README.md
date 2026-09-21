# Merge Window

A browser extension that makes it obvious when you are inside a merge freeze window,
and makes you work for it if you merge anyway.

Nothing off the shelf does this. [Merge Freeze](https://www.mergefreeze.com/) enforces
scheduled freezes server-side but is a paid GitHub App with no browser UI, and
[GitHub Merge Guardian](https://github.com/daku10/github-merge-guardian) recolors the
merge button but matches only on owner, repo, and branch — it has no concept of time.
GitHub itself has no scheduled code freeze in branch rules; it is
[an open feature request](https://github.com/orgs/community/discussions/157044).

## What it does

Inside the window, on every github.com page:

- Pins an orange banner to the top, with a countdown to when the window closes.
- Recolors the merge button dark red.
- Intercepts clicks on **Merge pull request**, **Squash and merge**, **Rebase and
  merge**, and the confirm variants, and requires you to type `MERGE` to proceed.

Outside the window it does nothing at all — no banner, no interception.

Default window: **10am–4pm America/Chicago, Monday through Friday.**

## Install

Chrome, Brave, Edge, or any other Chromium browser:

1. Open `chrome://extensions` (`brave://extensions` on Brave).
2. Turn on **Developer mode**, top right.
3. **Load unpacked**, and select this folder.
4. **Details → Extension options** to change the window.

The browser loads the extension from this path on every launch, so don't move or
delete the folder after installing.

Safari needs a conversion step (`xcrun safari-web-extension-converter`) and an Xcode
build. Firefox needs the manifest reworked for its MV3 variant. Neither is set up here.

## Options

| Setting | Default | Notes |
| --- | --- | --- |
| From / Until | 10am / 4pm | The window is inclusive of the start hour, exclusive of the end. 4pm is not frozen. |
| Timezone | `America/Chicago` | Any IANA name. Validated on save. |
| Days | Mon–Fri | |
| Enforcement | Block | `Block` requires typing `MERGE`. `Warn` is a plain confirm dialog. |

Timezone handling goes through `Intl.DateTimeFormat` rather than a fixed UTC offset,
so the window tracks daylight saving time without any seasonal edit. Verified against
both CST and CDT.

## Limits

This is a nudge in your browser, on your machine. It is worth being precise about what
it does not do:

- It does not stop `gh pr merge`, the GitHub API, or the mobile app.
- It does not stop anyone else on the team, unless they install it too.
- The `MERGE` prompt is an override by design. It is a speed bump, not a lock.

For actual enforcement, use a required status check that is evaluated at merge time.
A workflow that only runs on `pull_request` is not enough — it passes at 9am and stays
green, so you can still merge at 11am. Bind it to a merge queue so it re-runs on the
`merge_group` event, or run it on a schedule so it flips red on open PRs during the
window.

## Implementation notes

Two things worth knowing before editing `content.js`:

- **The merge button is matched on its visible text**, via the `MERGE_TEXT` regex, not
  on class names or data attributes. GitHub changes that markup often. If the banner
  appears but clicks go through, that regex is the thing to update.
- **Clicks are blocked in the capture phase** rather than by setting `disabled` on the
  button. GitHub's re-render clears a `disabled` attribute within a second; cancelling
  the event survives.
- **There is deliberately no MutationObserver.** `renderBanner` writes to the DOM, so
  observing the document re-enters it on its own writes and hangs the tab. Navigation
  is covered by `pageshow` and Turbo's events instead.

## Files

| File | |
| --- | --- |
| `manifest.json` | MV3 manifest. Host permission is `https://github.com/*` — add your GitHub Enterprise host here if you have one. |
| `content.js` | Window math, banner, click interception. |
| `content.css` | Banner and merge-button styling. |
| `options.html` / `options.js` | Settings page, stored in `chrome.storage.sync`. |

## License

MIT
