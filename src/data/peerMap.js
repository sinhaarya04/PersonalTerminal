// Peer groups for common tickers — shared across ComparisonTable, CorrelationMatrix, OverlayChart
export const PEER_MAP = {
  // Broad ETFs
  SPY:  ['QQQ', 'DIA', 'IWM', 'VTI'],
  QQQ:  ['SPY', 'ARKK', 'VGT', 'XLK'],
  DIA:  ['SPY', 'QQQ', 'IWM', 'VTI'],
  // Tech
  AAPL: ['MSFT', 'GOOG', 'AMZN', 'META'],
  MSFT: ['AAPL', 'GOOG', 'AMZN', 'META'],
  GOOG: ['AAPL', 'MSFT', 'META', 'AMZN'],
  GOOGL:['AAPL', 'MSFT', 'META', 'AMZN'],
  AMZN: ['AAPL', 'MSFT', 'GOOG', 'META'],
  META: ['GOOG', 'SNAP', 'PINS', 'MSFT'],
  NVDA: ['AMD', 'INTC', 'AVGO', 'TSM'],
  AMD:  ['NVDA', 'INTC', 'AVGO', 'QCOM'],
  TSLA: ['F', 'GM', 'RIVN', 'NIO'],
  // Finance
  JPM:  ['BAC', 'GS', 'MS', 'WFC'],
  BAC:  ['JPM', 'GS', 'C', 'WFC'],
  GS:   ['JPM', 'MS', 'BAC', 'C'],
  // Retail
  BURL: ['TJX', 'ROST', 'FIVE', 'DG'],
  TJX:  ['BURL', 'ROST', 'FIVE', 'DG'],
  WMT:  ['TGT', 'COST', 'AMZN', 'DG'],
  // Energy
  XOM:  ['CVX', 'COP', 'SLB', 'EOG'],
  CVX:  ['XOM', 'COP', 'SLB', 'OXY'],
};

export function getDefaultPeers(ticker) {
  return PEER_MAP[ticker] || ['SPY', 'QQQ', 'DIA', 'IWM'];
}
