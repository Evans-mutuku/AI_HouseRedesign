import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Self-hosted, subsetted variable fonts - no external CDN, no layout shift.
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';

import './index.css';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
