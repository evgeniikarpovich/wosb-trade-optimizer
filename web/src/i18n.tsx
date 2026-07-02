import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'en' | 'ru';

const en = {
  appTitle: 'Sea Trade Optimizer',
  appSubtitle: 'Buy low, sail, sell high — optimally.',

  routeSection: 'Route & ship',
  departure: 'Departure port',
  arrival: 'Arrival port',
  capacity: 'Cargo hold',
  budget: 'Budget',
  budgetHint: 'Money on hand — leave empty for unlimited',
  unlimited: 'unlimited',

  goodsSection: 'Goods',
  good: 'Good',
  weight: 'Weight',
  buyPrice: 'Buy',
  sellPrice: 'Sell',
  available: 'Stock',
  unitProfit: 'Profit/u',
  addGood: 'Add good',
  removeGood: 'Remove',
  namePlaceholder: 'name',
  loadSample: 'Reset to sample',

  pricesSection: 'Prices by port',
  price: 'Price',
  port: 'Port',
  portName: 'port name',
  addPort: 'Add port',
  removePort: 'Remove port',
  swap: 'Swap route',
  sameLocation: 'Departure and arrival are the same port.',
  catalogue: 'Goods & weights',

  resultsSection: 'Optimal plan',
  computing: 'Computing…',
  noTrade: 'No profitable trade on this route. Adjust prices or stock.',
  solver: 'Solver',
  exact: 'exact',
  greedy: 'greedy',
  optimal: 'optimal',
  approximate: 'approximate',

  totalProfit: 'Profit',
  spend: 'Spend',
  earn: 'Revenue',
  holdUsed: 'Hold used',
  budgetUsed: 'Budget used',
  gap: 'Max gap to optimum',

  shoppingList: 'Shopping list',
  quantity: 'Qty',
  lineProfit: 'Profit',
  lineCost: 'Cost',

  chartProfit: 'Profit by good',
  chartCargo: 'Cargo composition (by weight)',
  chartFree: 'free',

  language: 'Language',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  units: 'u',
};

export type Translations = typeof en;

const ru: Translations = {
  appTitle: 'Оптимизатор морской торговли',
  appSubtitle: 'Купи дёшево, доплыви, продай дорого — оптимально.',

  routeSection: 'Маршрут и корабль',
  departure: 'Порт отправления',
  arrival: 'Порт прибытия',
  capacity: 'Трюм',
  budget: 'Бюджет',
  budgetHint: 'Деньги на руках — пусто = без ограничения',
  unlimited: 'без ограничения',

  goodsSection: 'Товары',
  good: 'Товар',
  weight: 'Вес',
  buyPrice: 'Покупка',
  sellPrice: 'Продажа',
  available: 'Запас',
  unitProfit: 'Приб/ед',
  addGood: 'Добавить товар',
  removeGood: 'Удалить',
  namePlaceholder: 'название',
  loadSample: 'Сбросить к примеру',

  pricesSection: 'Цены по портам',
  price: 'Цена',
  port: 'Порт',
  portName: 'название порта',
  addPort: 'Добавить порт',
  removePort: 'Удалить порт',
  swap: 'Поменять местами',
  sameLocation: 'Порт отправления и прибытия совпадают.',
  catalogue: 'Товары и вес',

  resultsSection: 'Оптимальный план',
  computing: 'Вычисление…',
  noTrade: 'На этом маршруте нет выгодной торговли. Измените цены или запас.',
  solver: 'Алгоритм',
  exact: 'точный',
  greedy: 'жадный',
  optimal: 'оптимум',
  approximate: 'приближённо',

  totalProfit: 'Прибыль',
  spend: 'Затраты',
  earn: 'Выручка',
  holdUsed: 'Трюм занят',
  budgetUsed: 'Бюджет использован',
  gap: 'Макс. отрыв от оптимума',

  shoppingList: 'Список покупок',
  quantity: 'Кол-во',
  lineProfit: 'Прибыль',
  lineCost: 'Затраты',

  chartProfit: 'Прибыль по товарам',
  chartCargo: 'Состав груза (по весу)',
  chartFree: 'свободно',

  language: 'Язык',
  theme: 'Тема',
  light: 'Светлая',
  dark: 'Тёмная',
  units: 'ед',
};

const dictionaries: Record<Lang, Translations> = { en, ru };
const LOCALES: Record<Lang, string> = { en: 'en-US', ru: 'ru-RU' };

interface I18nValue {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: keyof Translations) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = 'wosb-lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
    if (navigator.language?.toLowerCase().startsWith('ru')) return 'ru';
  } catch {
    /* ignore */
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      locale: LOCALES[lang],
      setLang,
      t: (key) => dictionaries[lang][key],
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
