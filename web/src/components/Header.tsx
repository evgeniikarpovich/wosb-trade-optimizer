import { useI18n, type Lang } from '../i18n';
import { useTheme } from '../theme';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LangSwitch() {
  const { lang, setLang } = useI18n();
  const langs: Lang[] = ['en', 'ru'];
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={
            'px-2.5 py-1.5 text-xs font-semibold uppercase transition ' +
            (lang === l
              ? 'bg-blue-600 text-white'
              : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 text-lg">
            ⚓
          </span>
          <div>
            <h1 className="text-base font-bold leading-tight sm:text-lg">
              {t('appTitle')}
            </h1>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              {t('appSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LangSwitch />
          <button
            type="button"
            onClick={toggle}
            aria-label={t('theme')}
            title={theme === 'dark' ? t('light') : t('dark')}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}
