import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return local[0] + '***@' + domain;
}

function formatCurrency(v) {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const S = {
  wrap: {
    background: '#000',
    padding: '0',
    fontFamily: "'Consolas','Courier New',monospace",
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '2px solid #ff8c00',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#ff8c00',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#555',
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    background: '#1a1a2e',
    color: '#ff8c00',
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '6px 12px',
    borderBottom: '1px solid #333',
    textAlign: 'left',
    fontFamily: "'Consolas','Courier New',monospace",
  },
  thRight: {
    textAlign: 'right',
  },
  loading: {
    padding: '20px',
    color: '#ff8c00',
    fontSize: '12px',
    textAlign: 'center',
  },
  empty: {
    padding: '40px',
    color: '#555',
    fontSize: '12px',
    textAlign: 'center',
  },
};

function LeaderboardRow({ entry, rank, isCurrentUser }) {
  const [hover, setHover] = useState(false);
  const bg = isCurrentUser
    ? (hover ? '#1a3a5c' : '#0d1a2e')
    : (hover ? '#1a3a5c' : 'transparent');
  const returnColor = entry.total_return_pct >= 0 ? '#00cc00' : '#ff4444';
  const returnSign = entry.total_return_pct >= 0 ? '+' : '';

  const cellStyle = {
    padding: '5px 12px',
    borderBottom: '1px solid #1a1a1a',
    fontSize: '12px',
    fontFamily: "'Consolas','Courier New',monospace",
  };

  return (
    <tr
      style={{ background: bg, cursor: 'default' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td style={{ ...cellStyle, color: rank <= 3 ? '#ffcc00' : '#888', fontWeight: rank <= 3 ? 'bold' : 'normal', width: '50px' }}>
        {rank <= 3 ? ['1ST', '2ND', '3RD'][rank - 1] : rank}
      </td>
      <td style={{ ...cellStyle, color: isCurrentUser ? '#ffcc00' : '#b0b0b0' }}>
        {maskEmail(entry.user_id)}
        {isCurrentUser && <span style={{ color: '#ff8c00', fontSize: '9px', marginLeft: '6px' }}>YOU</span>}
      </td>
      <td style={{ ...cellStyle, color: '#888' }}>
        {entry.university || '—'}
      </td>
      <td style={{ ...cellStyle, color: '#fff', textAlign: 'right' }}>
        {formatCurrency(entry.total_value)}
      </td>
      <td style={{ ...cellStyle, color: returnColor, textAlign: 'right', fontWeight: 'bold' }}>
        {returnSign}{Number(entry.total_return_pct).toFixed(2)}%
      </td>
      <td style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>
        {formatCurrency(entry.cash)}
      </td>
      <td style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>
        {entry.num_positions}
      </td>
      <td style={{ ...cellStyle, color: '#444', textAlign: 'right', fontSize: '10px' }}>
        {new Date(entry.updated_at).toLocaleDateString()}
      </td>
    </tr>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      console.warn('[leaderboard] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>PAPER TRADING LEADERBOARD</span>
        <span style={S.subtitle}>
          {entries.length} TRADER{entries.length !== 1 ? 'S' : ''} · STARTING CAPITAL $100,000
        </span>
      </div>

      {loading ? (
        <div style={S.loading}>LOADING LEADERBOARD...</div>
      ) : entries.length === 0 ? (
        <div style={S.empty}>NO TRADES YET — BE THE FIRST TO TRADE</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>RANK</th>
              <th style={S.th}>TRADER</th>
              <th style={S.th}>UNIVERSITY</th>
              <th style={{ ...S.th, ...S.thRight }}>PORTFOLIO</th>
              <th style={{ ...S.th, ...S.thRight }}>RETURN</th>
              <th style={{ ...S.th, ...S.thRight }}>CASH</th>
              <th style={{ ...S.th, ...S.thRight }}>POSITIONS</th>
              <th style={{ ...S.th, ...S.thRight }}>UPDATED</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                rank={i + 1}
                isCurrentUser={user?.email === entry.user_id}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
