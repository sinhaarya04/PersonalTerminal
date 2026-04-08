import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

const ExportContext = createContext(null);

export function ExportProvider({ children }) {
  const registryRef = useRef(new Map());
  const [exportKeys, setExportKeys] = useState([]);

  const syncKeys = useCallback(() => {
    setExportKeys(
      Array.from(registryRef.current.entries()).map(([key, entry]) => ({
        key,
        label: entry.label,
      }))
    );
  }, []);

  const register = useCallback((key, label, fn) => {
    registryRef.current.set(key, { label, fn });
    syncKeys();
  }, [syncKeys]);

  const unregister = useCallback((key) => {
    registryRef.current.delete(key);
    syncKeys();
  }, [syncKeys]);

  const exportSelected = useCallback((selectedKeys) => {
    const keys = selectedKeys || Array.from(registryRef.current.keys());
    let delay = 0;
    for (const key of keys) {
      const entry = registryRef.current.get(key);
      if (entry?.fn) {
        setTimeout(() => entry.fn(), delay);
        delay += 150; // stagger downloads so browser doesn't block them
      }
    }
  }, []);

  return (
    <ExportContext.Provider value={{ register, unregister, exportKeys, exportSelected }}>
      {children}
    </ExportContext.Provider>
  );
}

export function useExport() {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error('useExport must be inside ExportProvider');
  return ctx;
}
