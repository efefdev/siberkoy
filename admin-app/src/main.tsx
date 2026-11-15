import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/pirata-one/latin.css';
import '@fontsource/pirata-one/latin-ext.css';
import '@fontsource/share-tech-mono/latin.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import '../../src/app/globals.css';
import './print.css';
import App from './App';
import { initLocalToken } from './local';

initLocalToken();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
