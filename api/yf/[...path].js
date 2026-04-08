const TARGET = 'https://query2.finance.yahoo.com';

// Yahoo blocks datacenter IPs unless a valid session cookie is present.
// Fetch https://fc.yahoo.com (always 404s but sets a valid A3 cookie),
// then reuse that cookie for the actual API call.
let cachedCookie = null;
let cookieExpiry = 0;

async function getYahooCookie() {
  if (cachedCookie && Date.now() < cookieExpiry) return cachedCookie;

  try {
    const res = await fetch('https://fc.yahoo.com', {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookies.length > 0) {
      cachedCookie = setCookies.map(c => c.split(';')[0]).join('; ');
      cookieExpiry = Date.now() + 5 * 60 * 1000; // cache 5 min
      return cachedCookie;
    }
  } catch { /* fall through */ }

  return '';
}

module.exports = async function handler(req, res) {
  const pathSegments = req.query.path || [];
  const targetPath = '/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments);

  const params = { ...req.query };
  delete params.path;
  const qs = new URLSearchParams(params).toString();
  const url = `${TARGET}${targetPath}${qs ? '?' + qs : ''}`;

  try {
    const cookie = await getYahooCookie();

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(response.status).send(body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
