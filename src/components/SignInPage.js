import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const S = {
  wrapper: {
    background: '#000000',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Consolas','Courier New',monospace",
  },
  card: {
    background: '#0d0d1a',
    border: '1px solid #ff8c00',
    padding: '40px 48px',
    width: '100%',
    maxWidth: '420px',
  },
  header: {
    color: '#ff8c00',
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  title: {
    color: '#ffcc00',
    fontSize: '20px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    marginBottom: '32px',
  },
  label: {
    color: '#ff8c00',
    fontSize: '10px',
    fontWeight: 'bold',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    background: '#000000',
    color: '#ffcc00',
    border: '1px solid #333333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '14px',
    padding: '8px 10px',
    outline: 'none',
    letterSpacing: '0.5px',
    boxSizing: 'border-box',
    marginBottom: '20px',
  },
  btn: {
    width: '100%',
    background: '#ff8c00',
    color: '#000000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    fontWeight: 'bold',
    padding: '10px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  error: {
    color: '#ff4444',
    fontSize: '11px',
    marginBottom: '12px',
  },
  footer: {
    color: '#333333',
    fontSize: '10px',
    textAlign: 'center',
    marginTop: '24px',
    letterSpacing: '0.5px',
  },
};

export default function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !university.trim()) {
      setError('ALL FIELDS REQUIRED');
      return;
    }
    if (!email.includes('@')) {
      setError('INVALID EMAIL ADDRESS');
      return;
    }
    signIn(email, university);
  }

  return (
    <div style={S.wrapper}>
      <form style={S.card} onSubmit={handleSubmit}>
        <div style={S.header}>BLOOMBERG TERMINAL</div>
        <div style={S.title}>SIGN IN</div>

        <label style={S.label}>EMAIL ADDRESS</label>
        <input
          style={S.input}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@university.edu"
          autoFocus
        />

        <label style={S.label}>UNIVERSITY</label>
        <input
          style={S.input}
          type="text"
          value={university}
          onChange={e => setUniversity(e.target.value)}
          placeholder="e.g. Northeastern University"
        />

        {error && <div style={S.error}>{error}</div>}

        <button type="submit" style={S.btn}>SIGN IN</button>

        <div style={S.footer}>DATA IS STORED LOCALLY ON YOUR DEVICE</div>
      </form>
    </div>
  );
}
