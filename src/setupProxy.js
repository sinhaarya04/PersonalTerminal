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

  // CoinGecko — crypto market data
  app.use(
    '/coingecko',
    createProxyMiddleware({
      target: 'https://api.coingecko.com',
      changeOrigin: true,
      pathRewrite: { '^/coingecko': '' },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)', Accept: 'application/json' },
      on: { error: (err, req, res) => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); } },
    })
  );

  // DeFi Llama — DeFi TVL data
  app.use(
    '/defillama',
    createProxyMiddleware({
      target: 'https://api.llama.fi',
      changeOrigin: true,
      pathRewrite: { '^/defillama': '' },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)', Accept: 'application/json' },
      on: { error: (err, req, res) => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); } },
    })
  );

  // Polymarket — prediction markets
  app.use(
    '/polymarket',
    createProxyMiddleware({
      target: 'https://gamma-api.polymarket.com',
      changeOrigin: true,
      pathRewrite: { '^/polymarket': '' },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)', Accept: 'application/json' },
      on: { error: (err, req, res) => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); } },
    })
  );

  // SEC EDGAR — company filings
  app.use(
    '/sec',
    createProxyMiddleware({
      target: 'https://efts.sec.gov',
      changeOrigin: true,
      pathRewrite: { '^/sec': '' },
      headers: { 'User-Agent': 'BloombergTerminalClone/1.0 (opensource@bloomberg-clone.dev)', Accept: 'application/json' },
      on: { error: (err, req, res) => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); } },
    })
  );

  // World Bank — global economic indicators
  app.use(
    '/worldbank',
    createProxyMiddleware({
      target: 'https://api.worldbank.org',
      changeOrigin: true,
      pathRewrite: { '^/worldbank': '' },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BloombergTerminalClone/1.0)', Accept: 'application/json' },
      on: { error: (err, req, res) => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); } },
    })
  );

  // YouTube live stream resolver — fetches channel /live page, extracts current video ID
  app.use('/ytlive', (req, res) => {
    const channelUrl = req.query.url;
    if (!channelUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }
    const https = require('https');
    const cache = app._ytliveCache || (app._ytliveCache = {});
    const cached = cache[channelUrl];
    if (cached && Date.now() < cached.exp) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ videoId: cached.videoId }));
      return;
    }

    function doFetch(url) {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 12000,
      }, (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          doFetch(proxyRes.headers.location);
          proxyRes.resume();
          return;
        }
        let body = '';
        proxyRes.on('data', chunk => { body += chunk; });
        proxyRes.on('end', () => {
          const m = body.match(/<link\s+rel="canonical"\s+href="[^"]*[?&]v=([a-zA-Z0-9_-]{11})"/)
               || body.match(/<meta\s+property="og:url"\s+content="[^"]*[?&]v=([a-zA-Z0-9_-]{11})"/)
               || body.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
          if (m) {
            cache[channelUrl] = { videoId: m[1], exp: Date.now() + 10 * 60 * 1000 };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ videoId: m[1] }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No live stream found' }));
          }
        });
      }).on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    }
    doFetch(channelUrl);
  });

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
