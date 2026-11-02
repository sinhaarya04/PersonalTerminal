// Keep the newest chart bar in step with the live quote between full chart fetches.

const INTERVAL_MS = { '15m': 15 * 60 * 1000, '30m': 30 * 60 * 1000, '60m': 60 * 60 * 1000 };

const dateIn = (ms, timeZone) => new Date(ms).toLocaleDateString('en-US', { timeZone });

function quoteTimeMs(quote) {
  if (quote?.regularMarketPrice == null || !quote.regularMarketTime) return null;
  return quote.regularMarketTime * 1000;
}

// Yahoo ends intraday series with an extra point stamped at the last trade, after the in-progress bar,
// so the current period starts at the bar before it.
function currentPeriodStart(bars, ms) {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  return prev && last.t - prev.t < ms ? prev.t : last.t;
}

// True when an intraday quote falls past the current bar, so a new bar has opened that we don't have yet.
export function quoteIsPastLastBar(bars, quote, interval) {
  const ms = INTERVAL_MS[interval];
  const qt = quoteTimeMs(quote);
  if (!ms || qt == null || !bars?.length) return false;
  return qt >= currentPeriodStart(bars, ms) + ms;
}

// Returns bars with the live quote merged into the newest bar (or a new daily bar for a new session).
export function applyLiveQuote(bars, quote, interval) {
  const qt = quoteTimeMs(quote);
  if (qt == null || !bars?.length) return bars;
  const last = bars[bars.length - 1];
  if (qt < last.t) return bars;
  const price = quote.regularMarketPrice;

  if (interval === '1d') {
    const dayHigh = quote.regularMarketDayHigh ?? price;
    const dayLow = quote.regularMarketDayLow ?? price;
    // Sessions are dated in the exchange's timezone (crypto trades on UTC days)
    const tz = quote.exchangeTimezoneName || 'America/New_York';
    if (dateIn(qt, tz) !== dateIn(last.t, tz)) {
      return [...bars, {
        t: qt,
        o: quote.regularMarketOpen || price,
        h: Math.max(dayHigh, price),
        l: Math.min(dayLow, price),
        c: price,
        v: quote.regularMarketVolume ?? 0,
      }];
    }
    return [...bars.slice(0, -1), {
      ...last,
      h: Math.max(last.h ?? price, dayHigh, price),
      l: Math.min(last.l ?? price, dayLow, price),
      c: price,
      v: quote.regularMarketVolume ?? last.v,
    }];
  }

  if (!INTERVAL_MS[interval] || quoteIsPastLastBar(bars, quote, interval)) return bars;
  return [...bars.slice(0, -1), {
    ...last,
    h: Math.max(last.h ?? price, price),
    l: Math.min(last.l ?? price, price),
    c: price,
  }];
}
