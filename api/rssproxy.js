module.exports = async function handler(req, res) {
  const feedUrl = req.query.url;
  if (!feedUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  // Validate URL
  let parsed;
  try {
    parsed = new URL(feedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    res.status(400).send('Invalid URL');
    return;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  };

  try {
    let response = await fetch(feedUrl, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });

    // Follow one redirect (matches setupProxy.js behavior)
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      const rawRedirect = response.headers.get('location');
      const redirectUrl = rawRedirect.startsWith('http')
        ? rawRedirect
        : new URL(rawRedirect, feedUrl).toString();

      response = await fetch(redirectUrl, {
        headers,
        signal: AbortSignal.timeout(12000),
      });
    }

    const contentType = response.headers.get('content-type') || 'text/xml';
    const body = await response.text();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(response.status).send(body);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      res.status(504).send('Timeout');
    } else {
      res.status(502).send(err.message);
    }
  }
};
