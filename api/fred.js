const TARGET = 'https://api.stlouisfed.org';

module.exports = async function handler(req, res) {
  const targetPath = req.query.path || '/';
  const params = { ...req.query };
  delete params.path;
  const qs = new URLSearchParams(params).toString();
  const url = `${TARGET}${targetPath}${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(response.status).send(body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
