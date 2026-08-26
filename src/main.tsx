import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "./i18n/provider"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <App />
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
)
