const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Yahoo Finance — dev server proxies server-side, bypasses CORS
  app.use(
    '/yf',
    createProxyMiddleware({
      target: 'https://query2.finance.yahoo.com',
      changeOrigin: true,
      pathRewrite: { '^/yf': '' },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
      on: {
        error: (err, req, res) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        },
      },
    })
  );

  // Google News RSS
  app.use(
    '/gnews',
    createProxyMiddleware({
      target: 'https://news.google.com',
      changeOrigin: true,
      pathRewrite: { '^/gnews': '' },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      on: {
        error: (err, req, res) => {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end(err.message);
        },
      },
    })
  );

  // arXiv API
  app.use(
    '/arxiv',
    createProxyMiddleware({
      target: 'https://export.arxiv.org',
      changeOrigin: true,
      pathRewrite: { '^/arxiv': '' },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)',
        Accept: 'application/atom+xml, application/xml, text/xml',
      },
      on: {
        error: (err, req, res) => {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end(err.message);
        },
      },
    })
  );

  // Semantic Scholar API
  app.use(
    '/semscholar',
    createProxyMiddleware({
      target: 'https://api.semanticscholar.org',
      changeOrigin: true,
      pathRewrite: { '^/semscholar': '' },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)',
        Accept: 'application/json',
      },
      on: {
        error: (err, req, res) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        },
      },
    })
  );

  // FRED (Federal Reserve Economic Data) API
  app.use(
    '/fred',
    createProxyMiddleware({
      target: 'https://api.stlouisfed.org',
      changeOrigin: true,
      pathRewrite: { '^/fred': '' },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)',
        Accept: 'application/json',
      },
      on: {
        error: (err, req, res) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        },
      },
    })
  );

  // RSS feed proxy — fetches any URL server-side to bypass CORS
  // Usage: /rssproxy?url=<encoded-feed-url>
  app.use('/rssproxy', (req, res) => {
    const feedUrl = req.query.url;
    if (!feedUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url parameter');
      return;
    }
    const https = require('https');
    const http = require('http');
    const parsedUrl = new URL(feedUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const proxyReq = client.get(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 12000,
    }, (proxyRes) => {
      // Follow redirects
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        const rawRedirect = proxyRes.headers.location;
        const redirectUrl = rawRedirect.startsWith('http') ? rawRedirect : new URL(rawRedirect, feedUrl).toString();
        const redirectClient = redirectUrl.startsWith('https') ? https : http;
        redirectClient.get(redirectUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          timeout: 12000,
        }, (redirectRes) => {
          if (!res.headersSent) {
            res.writeHead(redirectRes.statusCode, {
              'Content-Type': redirectRes.headers['content-type'] || 'text/xml',
              'Access-Control-Allow-Origin': '*',
            });
          }
          redirectRes.pipe(res);
        }).on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(err.message);
          }
        });
        return;
      }
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'text/xml',
          'Access-Control-Allow-Origin': '*',
        });
      }
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
    });
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'text/plain' });
        res.end('Timeout');
      }
    });
  });
};
