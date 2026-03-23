import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginGate from './components/LoginGate.jsx'
import { LanguageProvider } from './i18n.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <LoginGate>
        <App />
      </LoginGate>
    </LanguageProvider>
  </StrictMode>,
)
