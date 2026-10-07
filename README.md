---
project: true
---

# CuratorTube

A single-file YouTube RSS reader you can open directly in your browser — no server, no framework, no build step, no account required.

## What it does

CuratorTube lets you subscribe to YouTube channels by handle (`@username`) or RSS feed URL and displays their latest videos in a clean, responsive grid. Channels are collapsible, and everything persists in your browser's local storage across sessions. When served over HTTPS (e.g. GitHub Pages), it can be installed as a PWA via "Add to Home Screen" and opens offline.

## How to use

1. Download [`CuratorTube.html`](CuratorTube.html)
2. Open it in any modern browser (Chrome, Firefox, Edge, Safari)
3. Type a YouTube handle (e.g. `@mkbhd`) or a direct RSS feed URL and click **Add feed**
4. Click ↻ on any channel or **Refresh all** to load the latest videos

No installation, no dependencies. Your channels and the last videos fetched are stored in the browser, so the page opens instantly and works offline; refreshing still requires a connection.

## Features

- Add channels by `@handle` or RSS URL
- Collapsible per-channel video grids
- Configurable video limit per channel (5–15)
- Persists subscriptions and the latest videos in `localStorage`
- Per-feed and global refresh (three feeds at a time), with an inline message when a refresh fails
- **Export** subscriptions to JSON, **Import** from a JSON backup or an OPML file
- PWA-installable with offline support when hosted over HTTPS

## Hosting (optional, for the PWA)

`CuratorTube.html` works on its own when opened from disk. To get the installable, offline-capable PWA, serve it over HTTPS together with the files in [`pwa/`](pwa/) (`sw.js`, `manifest.webmanifest`, icons) at the same level, with the page named `index.html`.

The included workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) does this on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Disclaimers

**YouTube:** CuratorTube reads YouTube's publicly available RSS feeds (`youtube.com/feeds/videos.xml`). It is not affiliated with, endorsed by, or in any way officially connected to YouTube or Google. When adding a channel by `@handle`, the app makes a one-time request to YouTube's website to look up the corresponding RSS feed URL; after that, only the RSS feed itself is polled.

**CORS proxies:** Feed fetches are routed through [allorigins.win](https://allorigins.win) and [codetabs.com](https://codetabs.com) — free, community-run services with no SLA. They may be rate-limited, slow, or go offline at any time. If a proxy fails, the app automatically tries the next one.

## License

MIT — see [LICENSE](LICENSE).
