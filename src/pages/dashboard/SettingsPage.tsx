import { ModeToggle } from "@/components/mode-toggle"
import { useTranslation } from "react-i18next"
import { normalizeLocale, SUPPORTED_LOCALES } from "@/i18n/locale"

export default function SettingsPage() {
  const { i18n, t } = useTranslation('settings')
  const locale = normalizeLocale(i18n.language)
  const localeLabel = t(`locales.${locale}` as never)

  const handleLocaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(normalizeLocale(event.target.value))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">{t('appearance')}</h2>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('system')}</span>
          <ModeToggle />
        </div>
      </div>

      <div className="p-6 border rounded-lg bg-card space-y-3">
        <h2 className="text-xl font-semibold">{t('language')}</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="locale-select" className="text-muted-foreground">
            {t('currentLanguage')}
          </label>
          <select
            id="locale-select"
            value={locale}
            onChange={handleLocaleChange}
            aria-describedby="current-locale"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SUPPORTED_LOCALES.map((supportedLocale) => (
              <option key={supportedLocale} value={supportedLocale}>
                {t(`locales.${supportedLocale}` as never)}
              </option>
            ))}
          </select>
        </div>
        <p
          id="current-locale"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t('localeIndicator', { locale: localeLabel })}
          className="text-sm text-muted-foreground"
        >
          {t('localeIndicator', { locale: localeLabel })}
        </p>
      </div>

      <div className="p-10 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
        {t('moreComingSoon')}
      </div>
    </div>
  )
}
