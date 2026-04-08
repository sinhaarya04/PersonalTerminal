// Fallback demo data when no API key is provided

export const DEMO_INDICES = {
  americas: [
    { id: 4,  name: 'DOW JONES INDUS AVG',  value: 38547.33, netChg: -124.44, pctChg: -0.32, time: '4/7',  ytd: +6.25 },
    { id: 5,  name: 'S&P 500 INDEX',         value: 5204.34,  netChg: -18.85,  pctChg: -0.36, time: '4/7',  ytd: +8.75 },
    { id: 6,  name: 'NASDAQ COMPOSITE',      value: 16248.52, netChg: -54.21,  pctChg: -0.33, time: '4/7',  ytd: +5.12 },
    { id: 7,  name: 'S&P/TSX COMPOSITE',     value: 22614.11, netChg: +88.54,  pctChg: +0.39, time: '4/7',  ytd: +3.44 },
    { id: 8,  name: 'MEXICO IPC INDEX',      value: 55302.40, netChg: -211.67, pctChg: -0.38, time: '4/7',  ytd: -1.22 },
    { id: 9,  name: 'BRAZIL BOVESPA',        value: 127453.20,netChg: +634.55, pctChg: +0.50, time: '4/7',  ytd: +4.88 },
  ],
  emea: [
    { id: 10, name: 'EURO STOXX 50',         value: 4952.88,  netChg: -6.77,   pctChg: -0.14, time: '4/7',  ytd: +12.21 },
    { id: 11, name: 'FTSE 100',              value: 8302.55,  netChg: +14.22,  pctChg: +0.17, time: '4/7',  ytd: +5.66 },
    { id: 12, name: 'CAC 40',               value: 7824.17,  netChg: -22.34,  pctChg: -0.28, time: '4/7',  ytd: +8.33 },
    { id: 13, name: 'DAX',                  value: 18254.89, netChg: +88.45,  pctChg: +0.49, time: '4/7',  ytd: +11.47 },
    { id: 14, name: 'IBEX 35',              value: 10944.30, netChg: -44.10,  pctChg: -0.40, time: '4/7',  ytd: +9.02 },
    { id: 15, name: 'FTSE MIB',             value: 33847.55, netChg: +124.88, pctChg: +0.37, time: '4/7',  ytd: +14.11 },
    { id: 16, name: 'AEX INDEX',            value: 868.34,   netChg: -2.44,   pctChg: -0.28, time: '4/7',  ytd: +7.55 },
    { id: 17, name: 'OMX STOCKHOLM 30',     value: 2433.77,  netChg: +8.22,   pctChg: +0.34, time: '4/7',  ytd: +6.78 },
    { id: 18, name: 'SWISS MARKET INDEX',   value: 11814.42, netChg: -34.11,  pctChg: -0.29, time: '4/7',  ytd: +4.22 },
  ],
  asia: [
    { id: 24, name: 'NIKKEI 225',           value: 38460.08, netChg: +188.59, pctChg: +0.49, time: '4/7',  ytd: +14.59 },
    { id: 25, name: 'HANG SENG INDEX',      value: 23102.44, netChg: -88.33,  pctChg: -0.38, time: '4/7',  ytd: +22.14 },
    { id: 26, name: 'S&P/ASX 200',          value: 7844.10,  netChg: +22.44,  pctChg: +0.29, time: '4/7',  ytd: +3.88 },
  ]
};

export const DEMO_ALT_DATA = {
  ticker: 'BURL',
  name: 'BURLINGTON STORES INC',
  dataDate: '2026-04-07',
  about: {
    source: 'Bloomberg Second Measure',
    panelSize: '~14M US Consumers',
    geo: 'United States',
    cardType: 'Credit & Debit'
  },
  metrics: [
    {
      id: 'sales',
      label: 'Observed Sales',
      yoy91: 2.57, yoy28: 5.34, yoy7: 7.64,
      pop91: 7.27, pop28: -8.20, pop7: 0.06
    },
    {
      id: 'trans',
      label: 'Observed Trans.',
      yoy91: 5.88, yoy28: 9.14, yoy7: 10.92,
      pop91: 6.22, pop28: -5.71, pop7: -0.34
    },
    {
      id: 'customers',
      label: 'Observed Customers',
      yoy91: 3.22, yoy28: 7.08, yoy7: 10.33,
      pop91: 4.11, pop28: -5.29, pop7: 0.67
    },
    {
      id: 'avg_trans',
      label: 'Avg Transaction',
      yoy91: -3.12, yoy28: -3.49, yoy7: -2.96,
      pop91: 0.99, pop28: -2.64, pop7: 0.39
    },
    {
      id: 'trans_per_cust',
      label: 'Trans. per Customer',
      yoy91: 2.64, yoy28: 2.12, yoy7: 0.54,
      pop91: 2.10, pop28: -0.44, pop7: -1.01
    },
    {
      id: 'sales_per_cust',
      label: 'Sales per Customer',
      yoy91: -0.56, yoy28: 1.82, yoy7: 7.08,
      pop91: 3.07, pop28: -2.89, pop7: 1.06
    },
  ]
};

export const DEMO_COMPARISON = {
  metric: 'Observed Sales YoY Growth %',
  compSource: 'Analyst Curated (BI)',
  growthType: 'Year-over-Year',
  period: 'Weekly',
  weeks: ['3/7', '3/14', '3/21', '3/28', '4/4'],
  companies: [
    { ticker: 'BURL', name: 'Burlington Stores',  values: [2.57, 3.14, 4.22, 5.34, 7.64] },
    { ticker: 'TJX',  name: 'TJX Companies',       values: [4.88, 5.22, 3.11, 6.44, 8.12] },
    { ticker: 'ROST', name: 'Ross Stores',          values: [-1.22, 0.44, 2.88, 1.77, 3.55] },
    { ticker: 'CTRN', name: 'Citi Trends',          values: [-4.11, -2.88, -1.33, 0.22, 1.88] },
    { ticker: 'FIVE', name: 'Five Below',           values: [6.33, 7.44, 5.88, 9.12, 10.44] },
  ]
};

export const DEMO_NEWS = [
  {
    id: 1,
    title: 'Fed holds rates steady, signals two cuts possible in 2026',
    publisher: { name: 'Reuters' },
    published_utc: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    article_url: 'https://reuters.com',
    tickers: ['SPY', 'TLT']
  },
  {
    id: 2,
    title: 'S&P 500 slides on inflation data above expectations; tech leads losses',
    publisher: { name: 'Bloomberg' },
    published_utc: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    article_url: 'https://bloomberg.com',
    tickers: ['SPY', 'QQQ']
  },
  {
    id: 3,
    title: 'Burlington Stores (BURL) beats Q4 estimates, raises FY guidance',
    publisher: { name: 'Seeking Alpha' },
    published_utc: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    article_url: 'https://seekingalpha.com',
    tickers: ['BURL']
  },
  {
    id: 4,
    title: 'Oil falls 2% as OPEC+ signals output increase amid demand concerns',
    publisher: { name: 'WSJ' },
    published_utc: new Date(Date.now() - 62 * 60 * 1000).toISOString(),
    article_url: 'https://wsj.com',
    tickers: ['XOM', 'CVX', 'USO']
  },
  {
    id: 5,
    title: 'Nvidia surges 4% after analyst upgrades driven by AI chip demand cycle',
    publisher: { name: 'CNBC' },
    published_utc: new Date(Date.now() - 88 * 60 * 1000).toISOString(),
    article_url: 'https://cnbc.com',
    tickers: ['NVDA', 'AMD']
  },
  {
    id: 6,
    title: 'Treasury yields climb as markets price in higher-for-longer rate regime',
    publisher: { name: 'FT' },
    published_utc: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    article_url: 'https://ft.com',
    tickers: ['TLT', 'IEF']
  },
  {
    id: 7,
    title: 'JPMorgan raises S&P 500 year-end target to 5,800 on earnings resilience',
    publisher: { name: 'MarketWatch' },
    published_utc: new Date(Date.now() - 200 * 60 * 1000).toISOString(),
    article_url: 'https://marketwatch.com',
    tickers: ['SPY', 'JPM']
  },
];

export const DEMO_QUOTE = {
  ticker: 'BURL',
  name: 'BURLINGTON STORES INC',
  price: 272.84,
  change: +4.22,
  pctChange: +1.57,
  open: 268.62,
  high: 274.10,
  low: 267.88,
  volume: 1234567,
  avgVolume: 987654,
  mktCap: 18.4e9,
  pe: 28.4,
  eps: 9.60,
  week52High: 298.44,
  week52Low: 188.22,
};
