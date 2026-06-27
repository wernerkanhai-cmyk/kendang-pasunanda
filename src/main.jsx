import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthGate from './components/AuthGate.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LanguageProvider } from './i18n.jsx'
import { EditionProvider } from './edition/EditionContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { registerServiceWorker } from './lib/registerSW.js'

// Polyfill: iOS Safari only exposes crypto.randomUUID on secure contexts (HTTPS / localhost),
// not on plain LAN dev URLs. Provide a small RFC4122 v4 fallback so dev-on-iPad works.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = function () {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EditionProvider>
      <LanguageProvider>
        <AuthProvider>
          <AuthGate>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </AuthGate>
        </AuthProvider>
      </LanguageProvider>
    </EditionProvider>
  </StrictMode>,
)
