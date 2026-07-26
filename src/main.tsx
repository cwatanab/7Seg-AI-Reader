import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA Service Worker 登録 (自己署名証明書環境での SSL エラーを安全に防御)
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('✅ PWA Service Worker registered:', reg.scope))
      .catch((err) => {
        // 自己署名証明書 (IP直打ち等) での SSL 証明書未信頼警告を安全に無視
        console.warn('⚠️ Service Worker registration skipped (Self-signed SSL or unsupported context):', err.message || err);
      });
  });
}
