export function isMarketOpen() {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = est.getDay();
  const h = est.getHours();
  const m = est.getMinutes();
  const mins = h * 60 + m;
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960; // 9:30–16:00 ET
}

const EXCHANGES = [
  { name: 'NYSE',     tz: 'America/New_York',  open: [9,30],  close: [16,0]  },
  { name: 'NASDAQ',   tz: 'America/New_York',  open: [9,30],  close: [16,0]  },
  { name: 'LSE',      tz: 'Europe/London',     open: [8,0],   close: [16,30] },
  { name: 'TSE',      tz: 'Asia/Tokyo',        open: [9,0],   close: [15,0]  },
  { name: 'SSE',      tz: 'Asia/Shanghai',     open: [9,30],  close: [15,0]  },
  { name: 'NSE',      tz: 'Asia/Kolkata',      open: [9,15],  close: [15,30] },
  { name: 'HKEX',     tz: 'Asia/Hong_Kong',    open: [9,30],  close: [16,0]  },
];

export function getExchangeStatuses() {
  const now = new Date();
  return EXCHANGES.map(ex => {
    const local = new Date(now.toLocaleString('en-US', { timeZone: ex.tz }));
    const day = local.getDay();
    const mins = local.getHours() * 60 + local.getMinutes();
    const openMins = ex.open[0] * 60 + ex.open[1];
    const closeMins = ex.close[0] * 60 + ex.close[1];
    const isWeekday = day >= 1 && day <= 5;
    const inSession = isWeekday && mins >= openMins && mins < closeMins;
    const preMarket = isWeekday && mins >= openMins - 30 && mins < openMins;
    return {
      name: ex.name,
      status: inSession ? 'OPEN' : preMarket ? 'PRE' : 'CLOSED',
    };
  });
}
