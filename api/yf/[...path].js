const https = require('https');

const TARGET = 'https://query2.finance.yahoo.com';

// Yahoo blocks datacenter IPs without a valid session cookie + crumb.
// Flow: fc.yahoo.com → cookies → /v1/test/getcrumb → crumb
let cachedCookie = '';
let cachedCrumb = '';
let cacheExpiry = 0;

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const cookies = (res.headers['set-cookie'] || [])
        .map(c => c.split(';')[0])
        .join('; ');
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, cookies, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getAuth() {
  if (cachedCookie && cachedCrumb && Date.now() < cacheExpiry) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  try {
    // Step 1: Get cookies from fc.yahoo.com (always 404s but sets cookies)
    const cookieRes = await httpsGet('https://fc.yahoo.com', { 'User-Agent': ua });
    let cookie = cookieRes.cookies;

    if (!cookie) {
      // Fallback: try finance.yahoo.com
      const fallbackRes = await httpsGet('https://finance.yahoo.com/', { 'User-Agent': ua });
      cookie = fallbackRes.cookies;
    }

    if (!cookie) return { cookie: '', crumb: '' };

    // Step 2: Get crumb using the cookies
    const crumbRes = await httpsGet('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      'User-Agent': ua,
      'Cookie': cookie,
    });

    const crumb = crumbRes.status === 200 ? crumbRes.body.trim() : '';

    cachedCookie = cookie;
    cachedCrumb = crumb;
    cacheExpiry = Date.now() + 5 * 60 * 1000;

    return { cookie, crumb };
  } catch {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }
}

module.exports = async function handler(req, res) {
  const pathSegments = req.query.path || [];
  const targetPath = '/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments);

  const params = { ...req.query };
  delete params.path;

  const { cookie, crumb } = await getAuth();

  // Add crumb to query if we have one and it's not already there
  if (crumb && !params.crumb) {
    params.crumb = crumb;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${TARGET}${targetPath}${qs ? '?' + qs : ''}`;

  try {
    const response = await httpsGet(url, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      ...(cookie ? { 'Cookie': cookie } : {}),
    });

    const contentType = response.headers['content-type'] || 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(response.status).send(response.body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
