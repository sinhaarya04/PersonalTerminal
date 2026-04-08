import React, { useState, useEffect } from 'react';

const S = {
  container: {
    background: '#0d0d1a',
    border: '1px solid #333',
    padding: '10px 14px',
    minWidth: '260px',
    maxWidth: '300px',
  },
  title: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #333',
    paddingBottom: '4px',
    marginBottom: '8px',
    display: 'block',
  },
  ticker: {
    color: '#ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '16px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    display: 'block',
    marginBottom: '2px',
  },
  price: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '14px',
    display: 'block',
    marginBottom: '10px',
  },
  label: {
    color: '#888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'block',
    marginBottom: '2px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: '#000',
    color: '#ffcc00',
    border: '1px solid #333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    padding: '4px 8px',
    outline: 'none',
    marginBottom: '6px',
  },
  total: {
    color: '#b0b0b0',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    marginBottom: '10px',
    display: 'block',
  },
  btnRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
  },
  buyBtn: {
    flex: 1,
    background: '#00cc00',
    color: '#000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '6px 0',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  sellBtn: {
    flex: 1,
    background: '#ff4444',
    color: '#000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '6px 0',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  disabledBtn: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  cash: {
    color: '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    display: 'block',
    marginTop: '4px',
  },
  error: {
    color: '#ff4444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '4px',
  },
  success: {
    color: '#00cc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '4px',
  },
  posInfo: {
    color: '#666',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    display: 'block',
    marginBottom: '4px',
  },
};

function fmt(n) {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TradingPanel({ ticker, price, cash, position, onBuy, onSell, onTickerChange }) {
  const [shares, setShares] = useState('');
  const [msg, setMsg] = useState(null); // { text, type: 'error'|'success' }
  const [tickerInput, setTickerInput] = useState('');

  // Clear input when ticker changes
  useEffect(() => { setShares(''); setMsg(null); }, [ticker]);

  const handleTickerGo = () => {
    const sym = tickerInput.trim().toUpperCase();
    if (sym && onTickerChange) {
      onTickerChange(sym);
      setTickerInput('');
    }
  };

  // Auto-clear messages
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const numShares = parseInt(shares, 10);
  const valid = numShares > 0 && Number.isFinite(numShares);
  const total = valid && price ? numShares * price : 0;
  const canBuy = valid && price && total <= cash;
  const canSell = valid && position && numShares <= position.shares;

  const handleBuy = () => {
    if (!canBuy) return;
    const result = onBuy(ticker, numShares, price);
    if (result.success) {
      setMsg({ text: `BOUGHT ${numShares} ${ticker} @ $${fmt(price)}`, type: 'success' });
      setShares('');
    } else {
      setMsg({ text: result.error, type: 'error' });
    }
  };

  const handleSell = () => {
    if (!canSell) return;
    const result = onSell(ticker, numShares, price);
    if (result.success) {
      setMsg({ text: `SOLD ${numShares} ${ticker} @ $${fmt(price)}`, type: 'success' });
      setShares('');
    } else {
      setMsg({ text: result.error, type: 'error' });
    }
  };

  return (
    <div style={S.container}>
      <span style={S.title}>TRADE</span>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input
          style={{ ...S.input, marginBottom: 0, flex: 1, textTransform: 'uppercase' }}
          value={tickerInput}
          onChange={e => setTickerInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTickerGo()}
          placeholder={ticker || 'TICKER'}
          spellCheck={false}
        />
        <button
          style={{ background: '#ff8c00', color: '#000', border: 'none', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', cursor: 'pointer' }}
          onClick={handleTickerGo}
        >
          GO
        </button>
      </div>
      <span style={S.ticker}>{ticker}</span>
      <span style={S.price}>${price ? fmt(price) : '--'}</span>

      {position && (
        <span style={S.posInfo}>
          POSITION: {position.shares} SHARES @ ${fmt(position.avgCost)} AVG
        </span>
      )}

      <span style={S.label}>SHARES</span>
      <input
        style={S.input}
        type="number"
        min="1"
        step="1"
        value={shares}
        onChange={e => setShares(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && canBuy && handleBuy()}
        placeholder="0"
      />

      <span style={S.total}>
        TOTAL: ${valid && price ? fmt(total) : '0.00'}
      </span>

      {msg && (
        <span style={msg.type === 'error' ? S.error : S.success}>{msg.text}</span>
      )}

      <div style={S.btnRow}>
        <button
          style={{ ...S.buyBtn, ...(canBuy ? {} : S.disabledBtn) }}
          onClick={handleBuy}
          disabled={!canBuy}
        >
          BUY
        </button>
        <button
          style={{ ...S.sellBtn, ...(canSell ? {} : S.disabledBtn) }}
          onClick={handleSell}
          disabled={!canSell}
        >
          SELL
        </button>
      </div>

      <span style={S.cash}>CASH AVAILABLE: ${fmt(cash)}</span>
    </div>
  );
}
