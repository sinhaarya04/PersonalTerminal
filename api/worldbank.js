const https = require('https');
const TARGET = 'https://api.worldbank.org';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'BloombergTerminalClone/1.0', Accept: 'application/json' },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, contentType: res.headers['content-type'] }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async function handler(req, res) {
  const targetPath = req.query.path || '/';
  const params = { ...req.query };
  delete params.path;
  const qs = new URLSearchParams(params).toString();
  const url = `${TARGET}${targetPath}${qs ? '?' + qs : ''}`;
  try {
    const r = await httpsGet(url);
    res.setHeader('Content-Type', r.contentType || 'application/json');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.status(r.status).send(r.body);
  } catch (err) { res.status(502).json({ error: err.message }); }
};
