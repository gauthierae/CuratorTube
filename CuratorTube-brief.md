# CuratorTube — improvement brief for Claude Code (AgenticOS)

Goal: take CuratorTube from its initial state (`gauthierae/CuratorTube`, `main` at commit `2d02b22`) to a hardened, offline-capable, backup-friendly reader, in five ordered steps with **one commit per step**. This work was already done once in a Claude Code cloud session and then reverted on request; this brief lets you redo it. Reference commits from that session (may be garbage-collected): `02921f1`, `f7b6173`, `05117aa`, `19441d4`, `ee21ad7`, `e339174`.

## Project at the starting point

- Single-file app: `CuratorTube.html` (~1100 lines: ~590 lines CSS, HTML, then one inline `<script>`). Also `README.md`, `LICENSE`, `.gitignore`.
- A YouTube RSS reader: add channels by `@handle` or RSS URL, collapsible per-channel video grids, per-channel video limit (5–15), per-feed and global refresh, subscriptions in `localStorage` (`ct_feeds_v2`).
- No server, no build step, no dependencies. **Keep it that way**: the file must keep working when opened directly from disk (`file://`).
- Browsers cannot read YouTube directly (CORS), so the app uses free public CORS proxies (`api.allorigins.win`, `api.codetabs.com`) through a `fetchViaProxy` function. `@handle` resolution downloads the channel page through a proxy and regex-extracts the `feeds/videos.xml` link.
- UI is in English. Editorial design (Fraunces + Instrument Sans); reuse the existing CSS tokens and classes (`.nav-item`, `.status-line`, `.add-row`, `.btn`, modal markup). Do not redesign.

## Problems found in the initial code

1. The PWA service worker was registered from a `blob:` URL, which browsers refuse, and the error was swallowed. Offline mode and PWA install never worked, although the README claimed both.
2. Only the subscription list was persisted. Videos were re-fetched on every load, so the page was blank until proxies answered and stayed blank offline.
3. Video links and thumbnails from the feed were put in `href`/`src` without checking the scheme (`javascript:` link risk).
4. `JSON.parse(localStorage.getItem('ct_collapsed'))` was outside a `try`; a corrupted value stopped the whole script.
5. Refresh failures were only `console.warn`'d, invisible to the user.
6. `refreshAll` fired every request at once, which trips proxy rate limits.
7. Free proxies are unreliable. On the owner's machine all four public proxies failed (timeouts, HTTP 401, blocked), so adding `@dylandavisAI` was impossible. See step 5.
8. No backup/restore of subscriptions.

## Steps (one commit each, in this order)

### Step 1 — Harden links and storage
- Add `lsGet(key)` / `lsSet(key, value)` wrappers with try/catch and use them for every `localStorage` access (limit, collapsed set, feeds, later videos and proxy URL).
- Validate parsed values: `videoLimit` must be 5–15 (else 5); collapsed list must be an array; feeds must be an array of objects with `id` and `url`.
- In `fetchFeedData`, accept a video link or thumbnail only if it matches `/^https?:\/\//i`; otherwise rebuild from `videoId` (`https://www.youtube.com/watch?v=${encodeURIComponent(id)}` and `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`).
- Acceptance: a feed entry with `href="javascript:alert(1)"` renders a normal YouTube URL; corrupt `ct_collapsed` does not break startup.

### Step 2 — Local video cache, visible errors, throttled refresh
- Persist `videoCache` under `ct_videos_v1` (`saveVideos()`), load it at startup for existing feeds only, save after add / refresh / delete. Page must render cached videos instantly and offline.
- Add an in-memory `feedErrors` Map. On refresh failure store the message; on success clear it. In `renderChannels`, show a `.feed-error` line (muted red, 0.8125rem) above the grid: `Refresh failed (<message>). Last updated: <relative date>. Click ↻ to retry.`
- `refreshAll()` becomes async with a worker pool of `REFRESH_CONCURRENCY = 3`, guarded by a `refreshAllRunning` flag. Boot calls `refreshAll()`.
- Acceptance: after one successful add, going offline and reloading still shows the videos plus the error line.

### Step 3 — Export / import
- Add `Export` and `Import` items to the top nav (before `About`) and a hidden `<input type="file" id="import-file" accept=".json,.opml,.xml,…">`. Add a `<p class="status-line" id="data-status" role="status">` under the "Channels" header row.
- Export: download `curatortube-YYYY-MM-DD.json` = `{ app:'CuratorTube', version:1, exportedAt, videoLimit, feeds:[{name,url,addedAt}] }`. Say "Nothing to export yet." when empty.
- Import accepts that JSON **or OPML** (`outline[xmlUrl]`, name from `title` or `text`). Skip duplicates (same `url`) and non-`http(s)` URLs, give new ids, then refresh only the new feeds, 3 at a time. Report `Imported N channels, skipped M (duplicate or invalid).`; show `Import failed: …` for unrecognised files.
- Acceptance: export, clear storage, re-import restores the list; OPML with one new, one duplicate, one `javascript:` entry imports exactly one.

### Step 4 — Make the PWA real
- Create `pwa/` containing: `sw.js`, `manifest.webmanifest` (`start_url` and `scope` `./`, background/theme `#f5f2ec`, icons), `icon.svg` (red rounded square `#ff2020` with a white play triangle, as in the old inline icon), and PNG renders `icon-192.png` / `icon-512.png` (render the SVG with headless Chromium; no extra dependency needed).
- `sw.js`: precache shell (`./`, manifest, icons); same-origin GET = network first with cache fallback (fallback to `./` for navigation); fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) and thumbnails (`i.ytimg.com`) = stale-while-revalidate in a separate cache; everything else, notably CORS proxies, goes straight to the network and is never cached; clean old caches on activate.
- In `CuratorTube.html`: replace the blob manifest and blob service worker with `<link rel="manifest" href="manifest.webmanifest">`, `<link rel="icon" href="icon.svg">`, `<link rel="apple-touch-icon" href="icon-192.png">`, and register `sw.js` only when `location.protocol.startsWith('http')`. Opening via `file://` must still work (the manifest link just 404s harmlessly).
- Add `.github/workflows/pages.yml` (push to `main` + manual dispatch; permissions `contents: read, pages: write, id-token: write`; assemble `_site` with `cp CuratorTube.html _site/index.html` and `cp pwa/* _site/`; `actions/checkout@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`). The owner must enable Settings → Pages → Source: GitHub Actions once, and the workflow only runs on `main`.
- README: describe offline use honestly, add a "Hosting (optional, for the PWA)" section and the new features.
- Acceptance: served from a local static server, the service worker controls the page after a reload, the manifest loads, and the page renders offline.

### Step 5 — Robust `@handle` lookup and a personal proxy
This step answers a real failure reported by the owner (`api.allorigins.win: timeout; api.codetabs.com: timeout; corsproxy.io: HTTP 401; thingproxy.freeboard.io: blocked or unreachable`). It was done as two commits in the original session; either one or two is fine.
- `fetchViaProxy`: timeout 15 s; collect a per-proxy reason (`HTTP nnn`, `timeout`, `blocked or unreachable`, `empty response`) and throw one error joining them (`host: reason; host: reason`). Do not keep `thingproxy.freeboard.io` (unreachable); `corsproxy.io` can stay as a fallback but returned 401 for the owner.
- `resolveInput`: also accept a bare channel id (`^UC[A-Za-z0-9_-]{22}$`); keep the `feeds/videos.xml` link regex, then fall back to `"(externalId|channelId)":"(UC…)"` in the page; error text: `Could not look up @handle (<per-proxy reasons>). Try again later, or paste the channel URL (youtube.com/channel/UC…) instead.`
- `fetchFeedData`: reject responses that are not Atom (`!xml.querySelector('feed > entry, feed > title')`) with `Response is not a YouTube/Atom feed`, instead of adding an empty "Unknown Channel".
- **Personal proxy**: add `worker/cors-proxy.js`, a Cloudflare Worker (ES module `export default { fetch }`) that: answers `OPTIONS`; only allows GET; reads `?url=`; only allows `https:` and hosts `www.youtube.com` / `youtube.com` (403 otherwise); forwards with a browser-like `User-Agent`, `Accept-Language` and `Cookie: CONSENT=YES+1; SOCS=CAI` (skips the EU consent page); caches 300 s via `cf`; returns the body with `Access-Control-Allow-Origin: *`.
- In the app add a `Proxy` nav item opening the existing modal with an input and Save button, stored under `ct_proxy_url` (must start with `https://`, trailing slashes stripped, empty value removes it). `openModal(sourceId, onOpen)` gets an optional callback because modal content is copied via `innerHTML` and handlers must be attached after the copy. When set, the personal proxy (`${base}/?url=${encodeURIComponent(u)}`, response as text) is tried **before** the public ones.
- README: add a "Your own proxy (recommended)" section with the 5 deployment steps (Cloudflare account → Workers & Pages → Create Worker → Edit code, paste file → copy address → Proxy dialog → Save).
- Acceptance (mocked): with the proxy set and public ones failing, adding `@handle` hits the worker twice (page, then feed) and succeeds.

## Verification approach (important)

- The cloud sandbox cannot reach YouTube or the public proxies (egress is restricted). Verify with **Playwright + the preinstalled Chromium** and `page.route()` mocks of the proxy URLs and of `i.ytimg.com`, `fonts.*`. Do not try to run `playwright install`.
- Open the file via `file://` for steps 1–3 and 5; serve a copy (`index.html` + `pwa/*`) with a static server for step 4's service-worker test.
- Page-level checks: no `pageerror`; after each step re-run earlier tests (add, offline reload, export/import, proxy).
- Syntax-check the extracted inline script with `node --check`.
- In the owner's real environment, the only true end-to-end test is: deploy the Worker, paste its URL in **Proxy**, add `@dylandavisAI`. This was never executed live.

## Commit and delivery conventions

- Branch `claude/curatortube-improvements-gp51z2` (or the AgenticOS equivalent). One commit per step, clear messages, no PR unless asked.
- Preferred style of the owner: direct conversation in French with informal "tu"; artifacts and documents in a clear, plain "Zinsser" style. This brief and repo content are in English.

## Known limitations and follow-ups (not done)

- RSS 2.0 (`<item>`) feeds are not parsed; only Atom `<entry>`. Non-YouTube RSS URLs are accepted but show 0 videos.
- Not done from the original suggestion list: unified chronological view, new/seen markers, Shorts filter, search, reordering/tags, accessibility fixes (channel header is a `div onclick` and not keyboard-focusable; modal has no focus trap or `aria-labelledby`; ↻/✕ buttons only have `title`), event delegation instead of inline `onclick`, FR/EN interface, `Intl.RelativeTimeFormat`.
- `renderChannels()` still rebuilds the whole list on every state change (flicker, thumbnail reloads); update only the affected block.
- The Worker is untested in production; the public proxies can all be down at the same time.
