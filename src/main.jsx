import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { consumeGmailOAuthRedirectFromUrl } from './utils/gmailService'
import App from './App.jsx'

consumeGmailOAuthRedirectFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
