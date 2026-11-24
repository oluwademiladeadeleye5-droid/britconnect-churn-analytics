import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  PoundSterling,
  Cpu,
  Sparkles,
  Palette,
  RotateCcw,
  Download,
  Trash2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { LEAKAGE_EXCLUDED_COLUMNS } from '../data/dataDictionary';
import type {
  DatasetSnapshot,
  PlatformSettings,
} from '../types/britconnect';
import { formatNumber, formatTimestamp } from '../utils/formatters';
import { useToast } from '../context/ToastContext';

interface SettingsViewProps {
  settings: PlatformSettings;
  snapshot: DatasetSnapshot;
  onUpdateSettings: (next: PlatformSettings, options?: { retrain?: boolean }) => void;
  onResetSettings: () => void;
  onReloadDemoAndClear: () => void;
}

type SettingsTab = 'risk' | 'financial' | 'ml' | 'ai' | 'workspace';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  snapshot,
  onUpdateSettings,
  onResetSettings,
  onReloadDemoAndClear,
}) => {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('risk');
  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: string; quotaMB: string } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    if (!confirmClearOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmClearOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmClearOpen]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          const usageMB = ((est.usage ?? 0) / (1024 * 1024)).toFixed(2);
          const quotaMB = ((est.quota ?? 0) / (1024 * 1024)).toFixed(0);
          setStorageEstimate({ usageMB, quotaMB });
        })
        .catch(() => {});
    }
  }, [snapshot]);

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'risk', label: 'Risk & Scoring Rules', icon: ShieldAlert },
    { id: 'financial', label: 'Financial & ROI', icon: PoundSterling },
    { id: 'ml', label: 'ML Pipeline & Governance', icon: Cpu },
    { id: 'ai', label: 'AI & Playbook Rules', icon: Sparkles },
    { id: 'workspace', label: 'Appearance & Storage', icon: Palette },
  ];

  const handleExportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      platform: 'BritConnect AI Customer Churn Intelligence Platform',
      settings,
      datasetMetadata: snapshot.metadata,
      campaigns: snapshot.campaigns,
      playbooks: snapshot.playbooks,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `britconnect_workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Exported workspace backup (.json).');
  };

  return (
    <div className="space-y-6">
      {/* 5-Tab Horizontal Touch-Scrollable Switcher */}
      <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="inline-flex min-w-full sm:min-w-0 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                  active
                    ? 'bg-[#0B1F3A] dark:bg-[#132847] text-white dark:text-[#E0B44C]'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tab 1: Risk & Scoring Rules */}
      {activeTab === 'risk' && (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Risk Tier Cutoffs & High-Value Account Rules
            </h2>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
              Changes immediately recalculate every customer Risk Tier, Watchlist queue, and Dashboard tier distribution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#8B1E24] dark:text-[#C93842]">Critical Tier (&ge;)</span>
                <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                  {settings.criticalThresholdPct}%
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={95}
                step={1}
                value={settings.criticalThresholdPct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateSettings({
                    ...settings,
                    criticalThresholdPct: val,
                    highThresholdPct: Math.min(settings.highThresholdPct, val - 5),
                  });
                }}
                className="w-full accent-[#8B1E24]"
              />
            </div>

            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#B4821E] dark:text-[#E0B44C]">High Tier (&ge;)</span>
                <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                  {settings.highThresholdPct}%
                </span>
              </div>
              <input
                type="range"
                min={35}
                max={Math.max(36, settings.criticalThresholdPct - 5)}
                step={1}
                value={settings.highThresholdPct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateSettings({
                    ...settings,
                    highThresholdPct: val,
                    mediumThresholdPct: Math.min(settings.mediumThresholdPct, val - 5),
                  });
                }}
                className="w-full accent-[#C89B3C]"
              />
            </div>

            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#16325C] dark:text-[#4B7BEC]">Medium Tier (&ge;)</span>
                <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                  {settings.mediumThresholdPct}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={Math.max(11, settings.highThresholdPct - 5)}
                step={1}
                value={settings.mediumThresholdPct}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    mediumThresholdPct: Number(e.target.value),
                  })
                }
                className="w-full accent-[#0B1F3A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            <label className="block text-xs">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                High-Value Monthly Charge Threshold (£)
              </span>
              <input
                type="number"
                min={15}
                max={500}
                value={settings.highValueMonthlyGBP}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, highValueMonthlyGBP: Math.max(10, Number(e.target.value) || 65) })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>

            <label className="block text-xs">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                High-Value Lifetime Revenue Threshold (£)
              </span>
              <input
                type="number"
                min={100}
                max={50000}
                step={50}
                value={settings.highValueLifetimeGBP}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, highValueLifetimeGBP: Math.max(100, Number(e.target.value) || 1500) })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>

            <label className="block text-xs">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Contract Expiry Alert Window
              </span>
              <select
                value={settings.contractExpiryWindowDays}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    contractExpiryWindowDays: Number(e.target.value) as 30 | 60 | 90,
                  })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value={30}>30 Days Lookahead</option>
                <option value={60}>60 Days Lookahead (Default)</option>
                <option value={90}>90 Days Lookahead</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {/* Tab 2: Financial & ROI Assumptions */}
      {activeTab === 'financial' && (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Commercial Guardrails & ROI Assumptions
            </h2>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
              Controls ML Threshold Optimizer economics, Customer 360° What-If discount limits, AI Playbook budgets, and GBP formatting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <label className="block text-xs">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Default Offer Cost / Contacted (£)
              </span>
              <input
                type="number"
                min={5}
                max={250}
                value={settings.defaultOfferCostGBP}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, defaultOfferCostGBP: Math.max(1, Number(e.target.value) || 35) })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>

            <label className="block text-xs">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Maximum Allowed Discount Cap (%)
              </span>
              <input
                type="number"
                min={5}
                max={50}
                value={settings.maxDiscountCapPct}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    maxDiscountCapPct: Math.max(5, Math.min(50, Number(e.target.value) || 20)),
                  })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>

            <label className="block text-xs">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Expected Retention Success Rate (%)
              </span>
              <input
                type="number"
                min={10}
                max={90}
                value={settings.expectedRetentionRatePct}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    expectedRetentionRatePct: Math.max(10, Math.min(90, Number(e.target.value) || 45)),
                  })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>

            <label className="block text-xs">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Projected Revenue Horizon (Months)
              </span>
              <select
                value={settings.revenueHorizonMonths}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, revenueHorizonMonths: Number(e.target.value) })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (Default)</option>
                <option value={18}>18 Months</option>
                <option value={24}>24 Months</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
            <div>
              <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Currency & Locale Display (GBP £ · en-GB)
              </div>
              <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                Toggle between compact notation (£1.24m / £42.5k) and full GBP figures (£1,240,000).
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, compactCurrency: !settings.compactCurrency })}
              className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                settings.compactCurrency
                  ? 'bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16]'
                  : 'border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] text-[#0F172A] dark:text-[#F8FAFC]'
              }`}
            >
              {settings.compactCurrency ? 'Compact (£1.24m)' : 'Full (£1,240,000)'}
            </button>
          </div>
        </section>
      )}

      {/* Tab 3: ML Pipeline & Data Governance */}
      {activeTab === 'ml' && (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                In-Browser ML Pipeline & Governance
              </h2>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
                Configure model selection, stratified validation split, random seed, and missing-value rules.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings(settings, { retrain: true })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C89B3C] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              Apply & Retrain Pipeline Now
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
            <label className="block">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Champion Model Selection
              </span>
              <select
                value={settings.defaultChampionPreference}
                onChange={(e) =>
                  onUpdateSettings(
                    {
                      ...settings,
                      defaultChampionPreference: e.target.value as PlatformSettings['defaultChampionPreference'],
                    },
                    { retrain: true }
                  )
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value="auto">Auto (Highest ROC-AUC)</option>
                <option value="gbdt">Tree Ensemble (GBDT Stumps)</option>
                <option value="logreg">L2 Logistic Regression</option>
              </select>
            </label>

            <label className="block">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Train / Validation Split
              </span>
              <select
                value={settings.trainSplitRatio}
                onChange={(e) =>
                  onUpdateSettings(
                    {
                      ...settings,
                      trainSplitRatio: Number(e.target.value) as 75 | 80 | 85,
                    },
                    { retrain: true }
                  )
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value={75}>75% Train / 25% Val</option>
                <option value={80}>80% Train / 20% Val</option>
                <option value={85}>85% Train / 15% Val</option>
              </select>
            </label>

            <label className="block">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Reproducible Random Seed
              </span>
              <input
                type="number"
                min={1}
                max={999999}
                value={settings.randomSeed}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    randomSeed: Math.max(1, Number(e.target.value) || 2026),
                  })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>

            <label className="block">
              <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Missing Value Strategy
              </span>
              <select
                value={settings.missingValueStrategy}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    missingValueStrategy: e.target.value as PlatformSettings['missingValueStrategy'],
                  })
                }
                className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value="impute">Median / Mode Imputation</option>
                <option value="drop">Drop Incomplete Rows</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] dark:text-[#E0B44C]">
              <ShieldCheck className="h-4 w-4" />
              <span>Locked Target Leakage Guardrail Audit</span>
            </div>
            <p className="mt-1.5 text-xs text-[#475569] dark:text-[#94A3B8]">
              These post-outcome and identifier columns are permanently locked out of training & scoring features:
            </p>
            <div className="mt-2 font-mono text-[11px] text-[#0F172A] dark:text-[#F8FAFC]">
              {LEAKAGE_EXCLUDED_COLUMNS.join(' · ')}
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: AI Copilot & Playbook Preferences */}
      {activeTab === 'ai' && (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Gemini AI Copilot & Retention Playbook Preferences
            </h2>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
              Every setting below directly shapes the system instructions sent to Gemini for Copilot chat and Playbooks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-2">
              <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">AI Response Style</div>
              {(
                [
                  {
                    id: 'executive',
                    title: 'Executive Brief',
                    desc: 'Concise, boardroom-ready answers centered on commercial GBP impact.',
                  },
                  {
                    id: 'analytical',
                    title: 'Analytical Deep-Dive',
                    desc: 'Data-heavy breakdowns with multi-column comparison tables.',
                  },
                  {
                    id: 'frontline',
                    title: 'Frontline Retention Agent',
                    desc: 'Call-script hooks, objection handling, and immediate desk actions.',
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    settings.aiResponseStyle === opt.id
                      ? 'border-[#C89B3C] dark:border-[#E0B44C] bg-[#FFFBEB]/40 dark:bg-[#132847]'
                      : 'border-[#E2E8F0] dark:border-[#1E3A5F]'
                  }`}
                >
                  <input
                    type="radio"
                    name="aiResponseStyle"
                    checked={settings.aiResponseStyle === opt.id}
                    onChange={() => onUpdateSettings({ ...settings, aiResponseStyle: opt.id })}
                    className="mt-0.5 accent-[#0B1F3A]"
                  />
                  <div>
                    <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{opt.title}</div>
                    <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                  Default Playbook Horizon
                </span>
                <select
                  value={settings.defaultPlaybookHorizon}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      defaultPlaybookHorizon: e.target.value as PlatformSettings['defaultPlaybookHorizon'],
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="30-60-90">30-60-90 Day Plan (Default)</option>
                  <option value="14-day">Rapid 14-Day Intervention</option>
                </select>
              </label>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                <div>
                  <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    Auto-Include UK Telecom Ofcom Compliance Notes
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    Instructs Gemini to embed Ofcom fairness and transparent renewal reminders in every offer.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      autoIncludeOfcomCompliance: !settings.autoIncludeOfcomCompliance,
                    })
                  }
                  className={`h-8 rounded-lg px-3.5 text-xs font-semibold shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                    settings.autoIncludeOfcomCompliance
                      ? 'bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16]'
                      : 'border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] text-[#475569] dark:text-[#94A3B8]'
                  }`}
                >
                  {settings.autoIncludeOfcomCompliance ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tab 5: Appearance, Workspace & Storage Management */}
      {activeTab === 'workspace' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-5 shadow-xs">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                Appearance & Workspace Preferences
              </h2>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
                Persisted automatically across browser sessions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              <label className="block">
                <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                  Theme Mode
                </span>
                <select
                  value={settings.themeMode}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      themeMode: e.target.value as PlatformSettings['themeMode'],
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="light">Executive Light</option>
                  <option value="dark">Obsidian Navy Dark</option>
                  <option value="system">System Auto</option>
                </select>
              </label>

              <label className="block">
                <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                  Table & Grid Density
                </span>
                <select
                  value={settings.tableDensity}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      tableDensity: e.target.value as PlatformSettings['tableDensity'],
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="comfortable">Comfortable (Default)</option>
                  <option value="compact">Compact (High Density)</option>
                </select>
              </label>

              <label className="block">
                <span className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                  Default Landing Page
                </span>
                <select
                  value={settings.defaultLandingPage}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      defaultLandingPage: e.target.value as PlatformSettings['defaultLandingPage'],
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="overview">Executive Overview</option>
                  <option value="watchlist">Watchlist & Alerts</option>
                  <option value="customers">Customer Intelligence</option>
                </select>
              </label>
            </div>
          </section>

          {/* IndexedDB Storage Inspector */}
          <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-5 shadow-xs">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                IndexedDB Storage Inspector
              </h2>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
                All uploaded datasets, ML weights, scores, campaigns, and playbooks are stored locally in your browser.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                <div className="text-[#64748B] dark:text-[#94A3B8]">Active Dataset</div>
                <div className="mt-1 font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                  {snapshot.metadata.datasetName}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-[#475569] dark:text-[#94A3B8] tabular-nums">
                  {formatNumber(snapshot.metadata.rowCount)} rows
                </div>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                <div className="text-[#64748B] dark:text-[#94A3B8]">Last Saved</div>
                <div className="mt-1 font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                  {formatTimestamp(snapshot.metadata.lastSavedAt)}
                </div>
                <div className="mt-0.5 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  Source: {snapshot.metadata.sourceType}
                </div>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                <div className="text-[#64748B] dark:text-[#94A3B8]">Saved Artifacts</div>
                <div className="mt-1 font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                  {snapshot.campaigns.length} campaigns · {snapshot.playbooks.length} playbooks
                </div>
                <div className="mt-0.5 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  {snapshot.chatHistory.length} copilot messages
                </div>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                <div className="text-[#64748B] dark:text-[#94A3B8]">Browser Quota Usage</div>
                <div className="mt-1 font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                  {storageEstimate ? `${storageEstimate.usageMB} MB` : 'Active'}
                </div>
                <div className="mt-0.5 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  {storageEstimate ? `of ${storageEstimate.quotaMB} MB available` : 'IndexedDB persisted'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Full Workspace Backup (.json)</span>
              </button>

              <button
                type="button"
                onClick={onResetSettings}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-4 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Settings to BritConnect Defaults</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#8B1E24]/40 dark:border-[#C93842]/50 bg-[#FEF2F2] dark:bg-[#8B1E24]/20 px-4 text-xs font-semibold text-[#8B1E24] dark:text-[#F87171] hover:bg-[#FEE2E2] dark:hover:bg-[#8B1E24]/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Persisted Dataset & Reload Demo</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmClearOpen && (
        <div
          onClick={() => setConfirmClearOpen(false)}
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#040B16]/55 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2.5 text-[#8B1E24] dark:text-[#C93842]">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-display text-sm font-bold">Confirm Dataset Reset</h3>
            </div>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              This will clear the persisted IndexedDB workspace and reload the synthetic 600-customer BritConnect UK Telecom Demo Dataset. Any uploaded dataset, custom playbooks, and copilot history will be cleared.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="h-9 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#132847] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClearOpen(false);
                  onReloadDemoAndClear();
                }}
                className="h-9 rounded-lg bg-[#8B1E24] dark:bg-[#C93842] px-4 text-xs font-semibold text-white hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                Clear & Reload Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
