import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { applyTheme } from './lib/theme';

applyTheme();

// Si se publicó una versión nueva mientras la app estaba abierta, las partes que se cargan después
// (como el lector de PDF) ya no existen con el nombre viejo: se recarga una vez para traer la nueva.
addEventListener('vite:preloadError', (e) => {
  const KEY = 'mochi:recargada';
  try {
    if (sessionStorage.getItem(KEY) && Date.now() - Number(sessionStorage.getItem(KEY)) < 30_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {}
  e.preventDefault();
  location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
