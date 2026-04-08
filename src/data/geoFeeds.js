// WorldMonitor curated RSS feed list — organized by geographic region
// Source: https://github.com/koala73/worldmonitor (AGPL-3.0)
// All feeds fetched via rss2json CORS proxy

export const GEO_REGIONS = [
  { id: 'global',   label: 'GLOBAL',      color: '#ffcc00' },
  { id: 'americas', label: 'AMERICAS',    color: '#ff8c00' },
  { id: 'europe',   label: 'EUROPE',      color: '#4488ff' },
  { id: 'mideast',  label: 'MIDDLE EAST', color: '#ff6644' },
  { id: 'asia',     label: 'ASIA / PAC',  color: '#ff4488' },
  { id: 'africa',   label: 'AFRICA',      color: '#44cc88' },
  { id: 'finance',  label: 'FINANCE',     color: '#00cc00' },
  { id: 'tech',     label: 'TECH / AI',   color: '#88aaff' },
  { id: 'security', label: 'SECURITY',    color: '#ff4444' },
  { id: 'energy',   label: 'ENERGY',      color: '#ffaa00' },
];

export const GEO_FEEDS = {
  global: [
    { name: 'BBC WORLD',      url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'GUARDIAN WORLD', url: 'https://www.theguardian.com/world/rss' },
    { name: 'AP NEWS',        url: 'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en' },
    { name: 'REUTERS WORLD',  url: 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en' },
    { name: 'AL JAZEERA',     url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  ],
  americas: [
    { name: 'NPR NEWS',       url: 'https://feeds.npr.org/1001/rss.xml' },
    { name: 'POLITICO',       url: 'https://news.google.com/rss/search?q=site:politico.com+when:1d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'BBC LATAM',      url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
    { name: 'REUTERS LATAM',  url: 'https://news.google.com/rss/search?q=site:reuters.com+(Brazil+OR+Mexico+OR+Argentina)+when:3d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'GUARDIAN AMER',  url: 'https://www.theguardian.com/world/americas/rss' },
  ],
  europe: [
    { name: 'FRANCE 24',      url: 'https://www.france24.com/en/rss' },
    { name: 'EURONEWS',       url: 'https://www.euronews.com/rss?format=xml' },
    { name: 'DW NEWS',        url: 'https://rss.dw.com/xml/rss-en-all' },
    { name: 'LE MONDE [EN]',  url: 'https://www.lemonde.fr/en/rss/une.xml' },
    { name: 'DER SPIEGEL',    url: 'https://www.spiegel.de/schlagzeilen/tops/index.rss' },
    { name: 'KYIV INDEPENDENT', url: 'https://news.google.com/rss/search?q=site:kyivindependent.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'MOSCOW TIMES',   url: 'https://www.themoscowtimes.com/rss/news' },
  ],
  mideast: [
    { name: 'BBC MIDEAST',    url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
    { name: 'AL JAZEERA',     url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'GUARDIAN ME',    url: 'https://www.theguardian.com/world/middleeast/rss' },
    { name: 'ARAB NEWS',      url: 'https://news.google.com/rss/search?q=site:arabnews.com+(Saudi+Arabia+OR+UAE)+when:7d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'IRAN INTL',      url: 'https://news.google.com/rss/search?q=("Iran+International"+OR+Iran+nuclear+OR+Israel+Gaza)+when:2d&hl=en-US&gl=US&ceid=US:en' },
  ],
  asia: [
    { name: 'BBC ASIA',       url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    { name: 'THE DIPLOMAT',   url: 'https://thediplomat.com/feed/' },
    { name: 'NIKKEI ASIA',    url: 'https://news.google.com/rss/search?q=site:asia.nikkei.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'REUTERS ASIA',   url: 'https://news.google.com/rss/search?q=site:reuters.com+(China+OR+Japan+OR+Taiwan+OR+Korea)+when:3d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'SCMP',           url: 'https://www.scmp.com/rss/91/feed/' },
  ],
  africa: [
    { name: 'BBC AFRICA',     url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
    { name: 'AFRICA NEWS',    url: 'https://news.google.com/rss/search?q=(Africa+OR+Nigeria+OR+Kenya+OR+"South+Africa"+OR+Ethiopia)+when:2d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'AFRICANEWS',     url: 'https://www.africanews.com/feed/rss' },
    { name: 'JEUNE AFRIQUE',  url: 'https://www.jeuneafrique.com/feed/' },
    { name: 'SAHEL CRISIS',   url: 'https://news.google.com/rss/search?q=(Sahel+OR+Mali+OR+Niger+OR+"Burkina+Faso")+when:3d&hl=en-US&gl=US&ceid=US:en' },
  ],
  finance: [
    { name: 'CNBC MARKETS',   url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
    { name: 'REUTERS MKTS',   url: 'https://news.google.com/rss/search?q=site:reuters.com+markets+stocks+when:1d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'FT',             url: 'https://www.ft.com/rss/home' },
    { name: 'MARKETWATCH',    url: 'https://news.google.com/rss/search?q=site:marketwatch.com+markets+when:1d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'SEEKING ALPHA',  url: 'https://seekingalpha.com/market_currents.xml' },
    { name: 'FED RESERVE',    url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
    { name: 'ECON DATA',      url: 'https://news.google.com/rss/search?q=(CPI+OR+inflation+OR+GDP+OR+"jobs+report"+OR+PMI)+when:2d&hl=en-US&gl=US&ceid=US:en' },
  ],
  tech: [
    { name: 'HACKER NEWS',    url: 'https://hnrss.org/frontpage' },
    { name: 'ARS TECHNICA',   url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
    { name: 'THE VERGE',      url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'TECHCRUNCH',     url: 'https://techcrunch.com/feed/' },
    { name: 'AI NEWS',        url: 'https://news.google.com/rss/search?q=(OpenAI+OR+Anthropic+OR+Google+AI+OR+"large+language+model"+OR+ChatGPT)+when:2d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'MIT TECH REV',   url: 'https://www.technologyreview.com/feed/' },
    { name: 'VENTUREBEAT',    url: 'https://venturebeat.com/feed/' },
  ],
  security: [
    { name: 'KREBS SECURITY', url: 'https://krebsonsecurity.com/feed/' },
    { name: 'HACKER NEWS',    url: 'https://feeds.feedburner.com/TheHackersNews' },
    { name: 'DARK READING',   url: 'https://www.darkreading.com/rss.xml' },
    { name: 'SCHNEIER',       url: 'https://www.schneier.com/feed/' },
    { name: 'DEFENSE ONE',    url: 'https://www.defenseone.com/rss/all/' },
    { name: 'USNI NEWS',      url: 'https://news.usni.org/feed' },
    { name: 'THE WAR ZONE',   url: 'https://www.twz.com/feed' },
  ],
  energy: [
    { name: 'OIL & GAS',      url: 'https://news.google.com/rss/search?q=(oil+price+OR+OPEC+OR+"natural+gas"+OR+WTI+OR+Brent)+when:1d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'GOLD & METALS',  url: 'https://news.google.com/rss/search?q=(gold+price+OR+silver+price+OR+copper+OR+"precious+metals")+when:2d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'REUTERS ENERGY', url: 'https://news.google.com/rss/search?q=site:reuters.com+(oil+OR+gas+OR+energy+OR+OPEC)+when:3d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'NUCLEAR',        url: 'https://news.google.com/rss/search?q=("nuclear+energy"+OR+uranium+OR+IAEA)+when:3d&hl=en-US&gl=US&ceid=US:en' },
    { name: 'AGRICULTURE',    url: 'https://news.google.com/rss/search?q=(wheat+OR+corn+OR+soybeans+OR+coffee)+price+OR+commodity+when:3d&hl=en-US&gl=US&ceid=US:en' },
  ],
};
