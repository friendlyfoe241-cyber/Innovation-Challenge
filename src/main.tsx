import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import './styles/components.css';
import App from './App';

const rootEl = document.getElementById('root')!;
// Wait a frame before enabling reveal animations to avoid FOUC of hidden content.
requestAnimationFrame(() => document.documentElement.classList.add('js-ready'));

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
