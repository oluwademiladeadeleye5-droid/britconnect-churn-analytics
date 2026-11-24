import type { PlatformSettings, ThemeMode } from '../types/britconnect';

const SETTINGS_STORAGE_KEY = 'britconnect_platform_settings_v1';
const SIDEBAR_COLLAPSED_KEY = 'britconnect_sidebar_collapsed_v1';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  criticalThresholdPct: 75,
  highThresholdPct: 50,
  mediumThresholdPct: 25,
  highValueMonthlyGBP: 65,
  highValueLifetimeGBP: 1500,
  contractExpiryWindowDays: 60,

  defaultOfferCostGBP: 35,
  maxDiscountCapPct: 20,
  expectedRetentionRatePct: 45,
  revenueHorizonMonths: 12,
  compactCurrency: true,

  defaultChampionPreference: 'auto',
  trainSplitRatio: 80,
  randomSeed: 2026,
  missingValueStrategy: 'impute',

  aiResponseStyle: 'executive',
  autoIncludeOfcomCompliance: true,
  defaultPlaybookHorizon: '30-60-90',

  themeMode: 'light',
  tableDensity: 'comfortable',
  defaultLandingPage: 'overview',
};

export function loadPlatformSettings(): PlatformSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PLATFORM_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PlatformSettings>;
    return { ...DEFAULT_PLATFORM_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export function savePlatformSettings(settings: PlatformSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota
  }
}

export function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // ignore
  }
}

export function resolveEffectiveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function getChartThemePalette(isDark: boolean) {
  return {
    navy: isDark ? '#4B7BEC' : '#0B1F3A',
    midNavy: isDark ? '#3B679E' : '#16325C',
    slateNavy: isDark ? '#3B679E' : '#2C4A75',
    gold: isDark ? '#E0B44C' : '#C89B3C',
    crimson: isDark ? '#C93842' : '#8B1E24',
    crimsonSoft: isDark ? '#E05560' : '#B9383F',
    axisStroke: isDark ? '#1E3A5F' : '#E2E8F0',
    tickFill: isDark ? '#94A3B8' : '#475569',
    labelFill: isDark ? '#F8FAFC' : '#0F172A',
    tooltipStyle: {
      backgroundColor: isDark ? '#040B16' : '#0B1F3A',
      border: isDark ? '1px solid #1E3A5F' : '1px solid #16325C',
      borderRadius: '10px',
      color: '#F8FAFC',
      fontSize: '12px',
      padding: '8px 12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
    },
  };
}
