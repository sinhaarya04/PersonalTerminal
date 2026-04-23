const https = require('https');

// Cache resolved video IDs for 10 minutes
const cache = {};
const CACHE_TTL = 10 * 60 * 1000;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 12000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
        res.resume();
        return;
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractVideoId(html) {
  // Try canonical link first: <link rel="canonical" href="https://www.youtube.com/watch?v=VIDEO_ID">
  const canonical = html.match(/<link\s+rel="canonical"\s+href="[^"]*[?&]v=([a-zA-Z0-9_-]{11})"/);
  if (canonical) return canonical[1];

  // Try og:url meta tag
  const ogUrl = html.match(/<meta\s+property="og:url"\s+content="[^"]*[?&]v=([a-zA-Z0-9_-]{11})"/);
  if (ogUrl) return ogUrl[1];

  // Try videoId in JSON data
  const jsonId = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
  if (jsonId) return jsonId[1];

  return null;
}

module.exports = async function handler(req, res) {
  const channelUrl = req.query.url;
  if (!channelUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Check cache
  const cached = cache[channelUrl];
  if (cached && Date.now() < cached.exp) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({ videoId: cached.videoId });
  }

  try {
    const html = await httpsGet(channelUrl);
    const videoId = extractVideoId(html);

    if (!videoId) {
      return res.status(404).json({ error: 'No live stream found' });
    }

    // Cache it
    cache[channelUrl] = { videoId, exp: Date.now() + CACHE_TTL };

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.status(200).json({ videoId });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
