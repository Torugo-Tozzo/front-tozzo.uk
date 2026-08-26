import { Languages } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { useTranslation } from "react-i18next"
import { LOCALE_NATIVE_NAMES, normalizeLocale, SUPPORTED_LOCALES } from "@/i18n/locale"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function SettingsPage() {
  const { i18n, t } = useTranslation('settings')
  const locale = normalizeLocale(i18n.language)
  const localeLabel = t(`locales.${locale}` as never)

  const handleLocaleChange = (value: string) => {
    void i18n.changeLanguage(normalizeLocale(value))
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
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Languages className="h-5 w-5" />
          {t('language')}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="locale-select" className="text-muted-foreground">
            {t('currentLanguage')}
          </label>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger id="locale-select" aria-describedby="current-locale" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Each option shows the language's own name for itself (not
                  translated into the active UI language) so a speaker of
                  that language recognizes it at a glance in the picker. */}
              {SUPPORTED_LOCALES.map((supportedLocale) => (
                <SelectItem key={supportedLocale} value={supportedLocale}>
                  {LOCALE_NATIVE_NAMES[supportedLocale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
