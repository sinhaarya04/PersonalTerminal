import React, { useState, useEffect, useCallback } from 'react';
import { fetchEarningsData } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const MONO = "'Consolas','Courier New',monospace";

const S = {
  container: {
    background: '#000000',
    fontFamily: MONO,
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #ff8c00',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ff8c00',
    fontFamily: MONO,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerSub: {
    color: '#888888',
    fontFamily: MONO,
    fontSize: '11px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: MONO,
  },
  th: {
    background: '#0d0d1a',
    color: '#666666',
    fontFamily: MONO,
    fontSize: '10px',
    textTransform: 'uppercase',
    padding: '3px 8px',
    border: '1px solid #222222',
    fontWeight: 'normal',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  thLeft: {
    textAlign: 'left',
  },
  thRight: {
    textAlign: 'right',
  },
  td: {
    fontFamily: MONO,
    fontSize: '12px',
    color: '#cccccc',
    padding: '3px 8px',
    border: '1px solid #222222',
    whiteSpace: 'nowrap',
  },
  tdRight: {
    textAlign: 'right',
  },
  loading: {
    padding: '30px',
    color: '#ff8c00',
    fontFamily: MONO,
    fontSize: '12px',
    textAlign: 'center',
  },
  noData: {
    padding: '20px',
    color: '#666666',
    fontFamily: MONO,
    fontSize: '12px',
    textAlign: 'center',
  },
  footer: {
    padding: '4px 8px',
    borderTop: '1px solid #222222',
    color: '#444444',
    fontFamily: MONO,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};

function formatDate(unixSecs) {
  if (unixSecs == null) return 'TBD';
  const d = new Date(unixSecs * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatEPS(val) {
  if (val == null) return '--';
  return val.toFixed(2);
}

function isWithin7Days(unixSecs) {
  if (unixSecs == null) return false;
  const now = Date.now();
  const earningsMs = unixSecs * 1000;
  const diffMs = earningsMs - now;
  return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
}

function isConfirmed(start, end) {
  if (start == null || end == null) return false;
  return start === end;
}

function sortByEarnings(a, b) {
  const aTs = a.earningsTimestampStart;
  const bTs = b.earningsTimestampStart;
  if (aTs == null && bTs == null) return 0;
  if (aTs == null) return 1;
  if (bTs == null) return -1;
  return aTs - bTs;
}

export default function EarningsCalendar({ ticker, peers }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const { register, unregister } = useExport();

  const activeTicker = ticker || 'SPY';
  const allSymbols = peers && peers.length > 0 ? [activeTicker, ...peers] : [activeTicker];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await fetchEarningsData(allSymbols);
      setData(results || []);
    } catch {
      setData([]);
    }
    setLoading(false);
  }, [activeTicker]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data.length > 0) {
      register('EARNINGS', 'Earnings Calendar', () => {
        const date = new Date().toISOString().split('T')[0];
        const headers = ['symbol', 'name', 'next_earnings', 'status', 'fwd_eps', 'cy_eps', 'ttm_eps', 'price', 'chg_pct'];
        const rows = data.map(row => ({
          symbol: row.symbol,
          name: row.name || '',
          next_earnings: formatDate(row.earningsTimestampStart),
          status: row.earningsTimestampStart != null
            ? (isConfirmed(row.earningsTimestampStart, row.earningsTimestampEnd) ? 'CONF' : 'EST')
            : '',
          fwd_eps: formatEPS(row.epsForward),
          cy_eps: formatEPS(row.epsCurrentYear),
          ttm_eps: formatEPS(row.epsTTM),
          price: row.price != null ? row.price.toFixed(2) : '--',
          chg_pct: row.changePct != null
            ? (row.changePct >= 0 ? '+' : '') + row.changePct.toFixed(2) + '%'
            : '--',
        }));
        exportCSV(rows, `${activeTicker}_earnings_${date}.csv`, headers);
      });
    } else {
      unregister('EARNINGS');
    }
    return () => unregister('EARNINGS');
  }, [data, activeTicker, register, unregister]);

  const sorted = [...data].sort(sortByEarnings);

  if (loading) {
    return (
      <div style={S.container}>
        <div style={S.header}>
          <span style={S.headerTitle}>EARNINGS CAL — {activeTicker} + PEERS</span>
        </div>
        <div style={S.loading}>LOADING EARNINGS DATA...</div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.headerTitle}>EARNINGS CAL — {activeTicker} + PEERS</span>
        <span style={S.headerSub}>{sorted.length} TICKERS · YAHOO FINANCE</span>
      </div>

      {sorted.length === 0 ? (
        <div style={S.noData}>NO EARNINGS DATA AVAILABLE</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.thLeft }}>TICKER</th>
              <th style={{ ...S.th, ...S.thLeft }}>COMPANY</th>
              <th style={{ ...S.th, ...S.thLeft }}>NEXT EARNINGS</th>
              <th style={{ ...S.th, ...S.thLeft }}>STATUS</th>
              <th style={{ ...S.th, ...S.thRight }}>FWD EPS</th>
              <th style={{ ...S.th, ...S.thRight }}>CY EPS</th>
              <th style={{ ...S.th, ...S.thRight }}>TTM EPS</th>
              <th style={{ ...S.th, ...S.thRight }}>PRICE</th>
              <th style={{ ...S.th, ...S.thRight }}>%CHG</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isMain = row.symbol === activeTicker;
              const soon = isWithin7Days(row.earningsTimestampStart);
              const confirmed = isConfirmed(row.earningsTimestampStart, row.earningsTimestampEnd);
              const hasDate = row.earningsTimestampStart != null;

              const chgColor = row.changePct == null
                ? '#cccccc'
                : row.changePct >= 0 ? '#00cc00' : '#ff4444';

              const rowBg = soon ? '#1a1a00' : '#000000';

              return (
                <tr key={row.symbol} style={{ background: rowBg }}>
                  {/* TICKER */}
                  <td style={{
                    ...S.td,
                    ...S.thLeft,
                    color: '#ffcc00',
                    fontWeight: 'bold',
                    borderLeft: isMain ? '3px solid #ff8c00' : '3px solid transparent',
                  }}>
                    {row.symbol}
                  </td>

                  {/* COMPANY */}
                  <td style={{ ...S.td, ...S.thLeft, color: '#b0b0b0' }}>
                    {row.name || row.symbol}
                  </td>

                  {/* NEXT EARNINGS */}
                  <td style={{ ...S.td, ...S.thLeft, color: soon ? '#ffcc00' : '#cccccc' }}>
                    {formatDate(row.earningsTimestampStart)}
                  </td>

                  {/* STATUS */}
                  <td style={{ ...S.td, ...S.thLeft }}>
                    {hasDate ? (
                      <span style={{
                        color: confirmed ? '#00cc00' : '#ff8c00',
                        fontWeight: 'bold',
                        fontSize: '11px',
                      }}>
                        {confirmed ? 'CONF' : 'EST'}
                      </span>
                    ) : (
                      <span style={{ color: '#444444' }}>--</span>
                    )}
                  </td>

                  {/* FWD EPS */}
                  <td style={{ ...S.td, ...S.tdRight }}>
                    {formatEPS(row.epsForward)}
                  </td>

                  {/* CY EPS */}
                  <td style={{ ...S.td, ...S.tdRight }}>
                    {formatEPS(row.epsCurrentYear)}
                  </td>

                  {/* TTM EPS */}
                  <td style={{ ...S.td, ...S.tdRight }}>
                    {formatEPS(row.epsTTM)}
                  </td>

                  {/* PRICE */}
                  <td style={{ ...S.td, ...S.tdRight, color: '#ffffff' }}>
                    {row.price != null ? row.price.toFixed(2) : '--'}
                  </td>

                  {/* %CHG */}
                  <td style={{ ...S.td, ...S.tdRight, color: chgColor, fontWeight: 'bold' }}>
                    {row.changePct != null
                      ? (row.changePct >= 0 ? '+' : '') + row.changePct.toFixed(2) + '%'
                      : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={S.footer}>
        FWD = FORWARD 12M ESTIMATE · CY = CURRENT YEAR · TTM = TRAILING 12M · YAHOO FINANCE
      </div>
    </div>
  );
}
