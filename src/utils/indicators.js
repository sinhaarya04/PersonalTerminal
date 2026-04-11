// Technical indicator computations — all take bars [{c, ...}] and return aligned arrays with leading nulls

export function computeSMA(bars, period) {
  const result = new Array(bars.length).fill(null);
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].c;
    result[i] = sum / period;
  }
  return result;
}

export function computeEMA(bars, period) {
  const result = new Array(bars.length).fill(null);
  const k = 2 / (period + 1);
  // Seed with SMA of first `period` bars
  let sum = 0;
  for (let i = 0; i < period && i < bars.length; i++) sum += bars[i].c;
  if (bars.length < period) return result;
  result[period - 1] = sum / period;
  for (let i = period; i < bars.length; i++) {
    result[i] = bars[i].c * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function computeBollinger(bars, period = 20, mult = 2) {
  const result = new Array(bars.length).fill(null);
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].c;
    const mid = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (bars[j].c - mid) ** 2;
    const std = Math.sqrt(sqSum / period);
    result[i] = { mid, upper: mid + mult * std, lower: mid - mult * std };
  }
  return result;
}

export function computeRSI(bars, period = 14) {
  const result = new Array(bars.length).fill(null);
  if (bars.length < period + 1) return result;

  // Calculate initial average gain/loss
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = bars[i].c - bars[i - 1].c;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder smoothing
  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i].c - bars[i - 1].c;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function computeVWAP(bars) {
  const result = new Array(bars.length).fill(null);
  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < bars.length; i++) {
    const tp = (bars[i].h + bars[i].l + bars[i].c) / 3;
    cumTPV += tp * (bars[i].v || 0);
    cumVol += bars[i].v || 0;
    result[i] = cumVol > 0 ? cumTPV / cumVol : null;
  }
  return result;
}
