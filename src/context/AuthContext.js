import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const AUTH_KEY = 'bloomberg_auth_user';

function loadUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const signIn = useCallback((email, university) => {
    const u = { email: email.trim().toLowerCase(), university: university.trim() };
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
