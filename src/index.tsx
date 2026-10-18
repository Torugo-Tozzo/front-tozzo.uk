/* @refresh reload */
import { render } from 'solid-js/web'

import App from './App'
import './index.css'
import { ThemeProvider } from '@/components/theme-provider'
import { i18nReady } from '@/i18n/config'
import { I18nProvider } from '@/i18n/solid'

const root = document.getElementById('root')!

// index.html shows a spinner inside #root until the active locale is loaded.
void i18nReady.finally(() => {
  root.textContent = ''
  render(() => (
  <I18nProvider>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </I18nProvider>
  ), root)
})
