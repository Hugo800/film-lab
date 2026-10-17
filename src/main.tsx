import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { installAbfangen } from './ui/install';
import { initPersist } from './ui/persist';
import { adresseBereinigen } from './ui/route';

adresseBereinigen();
initPersist();
installAbfangen();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
