// Hardcoded FOMC meeting dates, CPI release dates, and NFP dates (2024–2026)
// Sources: federalreserve.gov, bls.gov

const FOMC_DATES = [
  // 2024
  { date: '2024-01-31', label: 'FOMC', detail: 'FOMC: HOLD 5.25-5.50%' },
  { date: '2024-03-20', label: 'FOMC', detail: 'FOMC: HOLD 5.25-5.50%' },
  { date: '2024-05-01', label: 'FOMC', detail: 'FOMC: HOLD 5.25-5.50%' },
  { date: '2024-06-12', label: 'FOMC', detail: 'FOMC: HOLD 5.25-5.50%' },
  { date: '2024-07-31', label: 'FOMC', detail: 'FOMC: HOLD 5.25-5.50%' },
  { date: '2024-09-18', label: 'FOMC', detail: 'FOMC: CUT TO 4.75-5.00% (-50BP)' },
  { date: '2024-11-07', label: 'FOMC', detail: 'FOMC: CUT TO 4.50-4.75% (-25BP)' },
  { date: '2024-12-18', label: 'FOMC', detail: 'FOMC: CUT TO 4.25-4.50% (-25BP)' },
  // 2025
  { date: '2025-01-29', label: 'FOMC', detail: 'FOMC: HOLD 4.25-4.50%' },
  { date: '2025-03-19', label: 'FOMC', detail: 'FOMC: HOLD 4.25-4.50%' },
  { date: '2025-05-07', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2025-06-18', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2025-07-30', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2025-09-17', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2025-10-29', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2025-12-17', label: 'FOMC', detail: 'FOMC MEETING' },
  // 2026
  { date: '2026-01-28', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2026-03-18', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2026-05-06', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2026-06-17', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2026-07-29', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2026-09-16', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2026-10-28', label: 'FOMC', detail: 'FOMC MEETING' },
  { date: '2026-12-16', label: 'FOMC', detail: 'FOMC MEETING' },
];

const CPI_DATES = [
  // 2024
  { date: '2024-01-11', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-02-13', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-03-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-04-10', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-05-15', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-06-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-07-11', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-08-14', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-09-11', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-10-10', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-11-13', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2024-12-11', label: 'CPI', detail: 'CPI RELEASE' },
  // 2025
  { date: '2025-01-15', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-02-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-03-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-04-10', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-05-13', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-06-11', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-07-15', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-08-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-09-10', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-10-14', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-11-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2025-12-10', label: 'CPI', detail: 'CPI RELEASE' },
  // 2026
  { date: '2026-01-14', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-02-11', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-03-11', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-04-14', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-05-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-06-10', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-07-14', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-08-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-09-15', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-10-13', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-11-12', label: 'CPI', detail: 'CPI RELEASE' },
  { date: '2026-12-10', label: 'CPI', detail: 'CPI RELEASE' },
];

// Convert to timestamp-based array
export const MACRO_EVENTS = [
  ...FOMC_DATES,
  ...CPI_DATES,
].map(e => ({
  t: new Date(e.date + 'T14:30:00Z').getTime(), // approximate release time
  label: e.label,
  detail: e.detail,
})).sort((a, b) => a.t - b.t);
