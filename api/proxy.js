const https = require('https');

const TARGETS = {
  arxiv: 'https://export.arxiv.org',
  semscholar: 'https://api.semanticscholar.org',
};

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...headers },
      timeout: 12000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location, headers).then(resolve).catch(reject);
        res.resume();
        return;
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ body, status: res.statusCode, contentType: res.headers['content-type'] }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Cache for ytlive
const cache = {};
const CACHE_TTL = 10 * 60 * 1000;

module.exports = async function handler(req, res) {
  const svc = req.query.svc;
  if (!svc) return res.status(400).json({ error: 'Missing svc parameter' });

  try {
    // ── arxiv / semscholar proxy ──
    if (TARGETS[svc]) {
      const targetPath = req.query.path || '/';
      const params = { ...req.query };
      delete params.svc;
      delete params.path;
      const qs = new URLSearchParams(params).toString();
      const url = `${TARGETS[svc]}${targetPath}${qs ? '?' + qs : ''}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)',
          Accept: svc === 'arxiv' ? 'application/atom+xml, application/xml, text/xml' : 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
      const contentType = response.headers.get('content-type') || (svc === 'arxiv' ? 'application/xml' : 'application/json');
      const body = await response.text();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', svc === 'arxiv' ? 's-maxage=300' : 's-maxage=60');
      return res.status(response.status).send(body);
    }

    // ── RSS proxy ──
    if (svc === 'rss') {
      const feedUrl = req.query.url;
      if (!feedUrl) return res.status(400).send('Missing url parameter');
      let parsed;
      try { parsed = new URL(feedUrl); if (!['http:', 'https:'].includes(parsed.protocol)) throw 0; } catch { return res.status(400).send('Invalid URL'); }

      let response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        const loc = response.headers.get('location');
        const redir = loc.startsWith('http') ? loc : new URL(loc, feedUrl).toString();
        response = await fetch(redir, {
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
          signal: AbortSignal.timeout(12000),
        });
      }
      const ct = response.headers.get('content-type') || 'text/xml';
      const body = await response.text();
      res.setHeader('Content-Type', ct);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 's-maxage=120');
      return res.status(response.status).send(body);
    }

    // ── YouTube live resolver ──
    if (svc === 'ytlive') {
      const channelUrl = req.query.url;
      if (!channelUrl) return res.status(400).json({ error: 'Missing url parameter' });
      const cached = cache[channelUrl];
      if (cached && Date.now() < cached.exp) {
        res.setHeader('Cache-Control', 's-maxage=600');
        return res.status(200).json({ videoId: cached.videoId });
      }
      const { body: html } = await httpsGet(channelUrl);
      const m = html.match(/<link\s+rel="canonical"\s+href="[^"]*[?&]v=([a-zA-Z0-9_-]{11})"/) ||
                html.match(/<meta\s+property="og:url"\s+content="[^"]*[?&]v=([a-zA-Z0-9_-]{11})"/) ||
                html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
      if (!m) return res.status(404).json({ error: 'No live stream found' });
      cache[channelUrl] = { videoId: m[1], exp: Date.now() + CACHE_TTL };
      res.setHeader('Cache-Control', 's-maxage=600');
      return res.status(200).json({ videoId: m[1] });
    }

    res.status(400).json({ error: `Unknown service: ${svc}` });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
