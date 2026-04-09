import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ExportProvider } from './context/ExportContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AuthProvider>
    <ExportProvider>
      <App />
    </ExportProvider>
  </AuthProvider>
);
