// CuratorTube personal CORS proxy — Cloudflare Worker.
// Only forwards GET requests to youtube.com, and adds the CORS header the browser needs.
// Usage: https://<your-worker>.workers.dev/?url=<encoded YouTube URL>

const ALLOWED_HOSTS = ['www.youtube.com', 'youtube.com'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });

    const target = new URL(request.url).searchParams.get('url');
    let url;
    try { url = new URL(target); } catch (e) {
      return new Response('Missing or invalid ?url=', { status: 400, headers: CORS });
    }
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.includes(url.hostname)) {
      return new Response('Only youtube.com is allowed', { status: 403, headers: CORS });
    }

    const upstream = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CuratorTube)',
        'Accept-Language': 'en-US,en;q=0.9',
        // Skips the cookie-consent interstitial that hides the feed link in the page.
        'Cookie': 'CONSENT=YES+1; SOCS=CAI',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    const headers = new Headers(CORS);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
