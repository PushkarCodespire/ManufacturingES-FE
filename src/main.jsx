import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Security fix #2 — one-time migration: evict any access token that was
// previously stored in localStorage (old behaviour). After this runs once,
// the key will never exist there again.
localStorage.removeItem('dt_token');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
