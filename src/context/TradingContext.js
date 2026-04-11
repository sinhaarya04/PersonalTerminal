import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const TradingContext = createContext(null);

const INITIAL_CASH = 100000;

const INITIAL_STATE = {
  version: 1,
  cash: INITIAL_CASH,
  startingCash: INITIAL_CASH,
  positions: {},
  transactions: [],
  portfolioHistory: [],
};

function storageKey(email) {
  return email ? `paper_trading_v1_${email.toLowerCase().trim()}` : 'paper_trading_v1';
}

function loadState(key) {
  try {
    let raw = localStorage.getItem(key);
    // Migrate: if per-user key is empty but legacy key exists, copy it over
    if (!raw && key !== 'paper_trading_v1') {
      raw = localStorage.getItem('paper_trading_v1');
      if (raw) localStorage.setItem(key, raw);
    }
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return INITIAL_STATE;
    return parsed;
  } catch {
    return INITIAL_STATE;
  }
}

function saveState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch { /* ignore quota errors */ }
}

function reducer(state, action) {
  switch (action.type) {
    case 'BUY': {
      const { symbol, shares, price } = action;
      const total = shares * price;
      if (total > state.cash) return state;
      if (shares <= 0 || !Number.isInteger(shares)) return state;

      const prev = state.positions[symbol];
      const newShares = (prev?.shares || 0) + shares;
      const newTotalCost = (prev?.totalCost || 0) + total;

      return {
        ...state,
        cash: state.cash - total,
        positions: {
          ...state.positions,
          [symbol]: {
            symbol,
            shares: newShares,
            avgCost: newTotalCost / newShares,
            totalCost: newTotalCost,
          },
        },
        transactions: [
          {
            id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'BUY',
            symbol,
            shares,
            price,
            total,
            timestamp: Date.now(),
          },
          ...state.transactions,
        ],
      };
    }

    case 'SELL': {
      const { symbol, shares, price } = action;
      const pos = state.positions[symbol];
      if (!pos || shares > pos.shares) return state;
      if (shares <= 0 || !Number.isInteger(shares)) return state;

      const total = shares * price;
      const remaining = pos.shares - shares;
      const newPositions = { ...state.positions };

      if (remaining === 0) {
        delete newPositions[symbol];
      } else {
        newPositions[symbol] = {
          ...pos,
          shares: remaining,
          totalCost: pos.avgCost * remaining,
        };
      }

      return {
        ...state,
        cash: state.cash + total,
        positions: newPositions,
        transactions: [
          {
            id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'SELL',
            symbol,
            shares,
            price,
            total,
            timestamp: Date.now(),
          },
          ...state.transactions,
        ],
      };
    }

    case 'SNAPSHOT': {
      const { value, cash, spyValue } = action;
      const history = [...state.portfolioHistory];
      const now = Date.now();
      const today = new Date(now).toDateString();

      // Update today's entry or push new one
      if (history.length > 0 && new Date(history[history.length - 1].timestamp).toDateString() === today) {
        history[history.length - 1] = { timestamp: now, value, cash, spyValue };
      } else {
        history.push({ timestamp: now, value, cash, spyValue });
      }

      return { ...state, portfolioHistory: history };
    }

    case 'RESET':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

export function TradingProvider({ userEmail, userUniversity, children }) {
  const key = storageKey(userEmail);
  const [state, dispatch] = useReducer(reducer, key, loadState);

  // Persist on every state change
  useEffect(() => { saveState(key, state); }, [key, state]);

  // Sync portfolio snapshot to leaderboard after state changes
  const syncLeaderboard = useCallback((currentState) => {
    if (!userEmail) return;
    const positions = Object.values(currentState.positions);
    const numPositions = positions.length;
    // total_value = cash (positions value needs live prices, so we use the last snapshot if available)
    const lastSnapshot = currentState.portfolioHistory[currentState.portfolioHistory.length - 1];
    const totalValue = lastSnapshot?.value ?? currentState.cash;
    const totalReturnPct = ((totalValue - INITIAL_CASH) / INITIAL_CASH) * 100;

    fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userEmail,
        university: userUniversity || '',
        total_value: totalValue,
        total_return_pct: totalReturnPct,
        cash: currentState.cash,
        num_positions: numPositions,
      }),
    }).catch(() => {});
  }, [userEmail, userUniversity]);

  const executeBuy = useCallback((symbol, shares, price) => {
    const total = shares * price;
    if (total > state.cash) return { success: false, error: 'INSUFFICIENT FUNDS' };
    if (shares <= 0 || !Number.isInteger(shares)) return { success: false, error: 'INVALID SHARES' };
    dispatch({ type: 'BUY', symbol, shares, price });
    // Sync after trade — use next tick so state has updated
    setTimeout(() => syncLeaderboard({ ...state, cash: state.cash - total, positions: { ...state.positions, [symbol]: { shares: (state.positions[symbol]?.shares || 0) + shares } } }), 0);
    return { success: true };
  }, [state, syncLeaderboard]);

  const executeSell = useCallback((symbol, shares, price) => {
    const pos = state.positions[symbol];
    if (!pos) return { success: false, error: 'NO POSITION' };
    if (shares > pos.shares) return { success: false, error: `ONLY ${pos.shares} SHARES OWNED` };
    if (shares <= 0 || !Number.isInteger(shares)) return { success: false, error: 'INVALID SHARES' };
    dispatch({ type: 'SELL', symbol, shares, price });
    setTimeout(() => syncLeaderboard({ ...state, cash: state.cash + shares * price }), 0);
    return { success: true };
  }, [state, syncLeaderboard]);

  const resetPortfolio = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const recordSnapshot = useCallback((value, cash, spyValue) => {
    dispatch({ type: 'SNAPSHOT', value, cash, spyValue });
    // Sync accurate portfolio value to leaderboard
    if (userEmail) {
      const numPositions = Object.keys(state.positions).length;
      const totalReturnPct = ((value - INITIAL_CASH) / INITIAL_CASH) * 100;
      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userEmail,
          university: userUniversity || '',
          total_value: value,
          total_return_pct: totalReturnPct,
          cash,
          num_positions: numPositions,
        }),
      }).catch(() => {});
    }
  }, [userEmail, userUniversity, state.positions]);

  return (
    <TradingContext.Provider value={{
      cash: state.cash,
      startingCash: state.startingCash,
      positions: state.positions,
      transactions: state.transactions,
      portfolioHistory: state.portfolioHistory,
      executeBuy,
      executeSell,
      resetPortfolio,
      recordSnapshot,
    }}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error('useTrading must be inside TradingProvider');
  return ctx;
}
