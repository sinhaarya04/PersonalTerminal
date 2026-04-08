const TARGET = 'https://query2.finance.yahoo.com';

module.exports = async function handler(req, res) {
  const pathSegments = req.query.path || [];
  const targetPath = '/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments);

  const params = { ...req.query };
  delete params.path;
  const qs = new URLSearchParams(params).toString();
  const url = `${TARGET}${targetPath}${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
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
