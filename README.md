# Merge Window

Chrome extension. Warns you before you merge a GitHub PR during hours you shouldn't.

Inside the window it pins a banner to the top of github.com, turns the merge button
red, and makes you type `MERGE` to get past a merge click. Outside the window it does
nothing.

Default: **10am–4pm America/Chicago, Monday through Friday.**

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**, top right.
3. Click **Load unpacked** and pick this folder.

Chrome loads it from this path at every launch, so leave the folder where it is.

## Configure

**Details → Extension options**, on the same `chrome://extensions` page.

- **From / Until** — 10am–4pm blocks 10:00 through 3:59pm. At 4:00 you're clear.
- **Timezone** — any IANA name. Follows daylight saving on its own.
- **Days**
- **Enforcement** — `Block` requires typing `MERGE`. `Warn` is a plain confirm dialog.

## This does not enforce anything

It's a speed bump in your browser. It doesn't stop `gh pr merge`, the API, the mobile
app, or anyone who hasn't installed it. The `MERGE` prompt is an override by design.

For real enforcement, use a required status check evaluated at merge time — a workflow
that runs only on `pull_request` goes green at 9am and still lets you merge at 11am, so
bind it to a merge queue and run it on `merge_group`. Or use
[Merge Freeze](https://www.mergefreeze.com/), a paid app that does scheduled freezes
server-side.

## Editing it

Three things that will bite you, all in `content.js`:

- The merge button is matched on its **visible text** (`MERGE_TEXT`), not on classes or
  data attributes, because GitHub churns that markup. Banner shows but clicks go
  through? Fix that regex.
- Clicks are cancelled in the **capture phase**. Setting `disabled` on the button
  doesn't survive GitHub's next re-render.
- **No MutationObserver.** `renderBanner` writes to the DOM, so observing the document
  re-enters it on its own writes and freezes the tab. Navigation is handled by
  `pageshow` and Turbo events.

MIT.
