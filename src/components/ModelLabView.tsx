import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  RefreshCw,
  ShieldCheck,
  Award,
  SlidersHorizontal,
  BarChart3,
  Activity,
  GitBranch,
  Eye,
  X,
  ArrowRight,
} from 'lucide-react';
import type {
  PlatformSettings,
  ScoredCustomerRecord,
  TrainedModelBundle,
} from '../types/britconnect';
import { evaluateAtThreshold } from '../utils/mlEngine';
import {
  formatCurrencyDisplay,
  formatGBP,
  formatNumber,
  formatPercent,
  formatTimestamp,
} from '../utils/formatters';
import { getChartThemePalette } from '../utils/settings';
import { useCrossFilter } from '../context/CrossFilterContext';
import { useToast } from '../context/ToastContext';
import {
  ChartCard,
  ChartTooltip,
  InteractiveLegend,
  explainFeatureDriver,
} from './ChartUI';

interface ModelLabViewProps {
  modelBundle: TrainedModelBundle;
  customers: ScoredCustomerRecord[];
  settings: PlatformSettings;
  isDark: boolean;
  onSelectChampion: (modelId: 'logreg' | 'gbdt') => void;
  onUpdateThreshold: (threshold: number) => void;
  onRetrain: () => void;
  onSelectCustomer: (customer: ScoredCustomerRecord) => void;
  isRetraining: boolean;
}

type ModelLabTab = 'benchmarks' | 'optimizer' | 'drivers';

export const ModelLabView: React.FC<ModelLabViewProps> = ({
  modelBundle,
  customers,
  settings,
  isDark,
  onSelectChampion,
  onUpdateThreshold,
  onRetrain,
  onSelectCustomer,
  isRetraining,
}) => {
  const [activeTab, setActiveTab] = useState<ModelLabTab>('optimizer');
  const [offerCost, setOfferCost] = useState(settings.defaultOfferCostGBP);
  const [selectedDriverKey, setSelectedDriverKey] = useState<string | null>(null);
  const [hiddenRocSeries, setHiddenRocSeries] = useState<string[]>([]);
  const [hoveredDriverIdx, setHoveredDriverIdx] = useState<number | null>(null);
  const palette = useMemo(() => getChartThemePalette(isDark), [isDark]);

  const { crossFilters, setConfusionBucket } = useCrossFilter();
  const { notify } = useToast();

  useEffect(() => {
    setOfferCost(settings.defaultOfferCostGBP);
  }, [settings.defaultOfferCostGBP]);

  const champion = modelBundle.models[modelBundle.championModelId];
  const modelsList = [modelBundle.models.gbdt, modelBundle.models.logreg];

  const thresholdMetrics = useMemo(
    () =>
      evaluateAtThreshold(
        champion.validationPredictions,
        modelBundle.decisionThreshold,
        offerCost,
        settings.expectedRetentionRatePct,
        settings.revenueHorizonMonths
      ),
    [
      champion.validationPredictions,
      modelBundle.decisionThreshold,
      offerCost,
      settings.expectedRetentionRatePct,
      settings.revenueHorizonMonths,
    ]
  );

  // Validation Cohort Preview matched to selected Confusion Matrix bucket
  const selectedConfusionRows = useMemo(() => {
    const bucket = crossFilters.confusionBucket;
    if (bucket === 'All') return [];
    const t = modelBundle.decisionThreshold;
    return champion.validationPredictions
      .map((item, idx) => {
        const pred = item.probability >= t ? 1 : 0;
        const cell: 'TP' | 'FP' | 'FN' | 'TN' =
          pred === 1 && item.actual === 1
            ? 'TP'
            : pred === 1 && item.actual === 0
            ? 'FP'
            : pred === 0 && item.actual === 1
            ? 'FN'
            : 'TN';
        return { ...item, cell, idx };
      })
      .filter((x) => x.cell === bucket)
      .sort((a, b) => b.probability - a.probability);
  }, [crossFilters.confusionBucket, champion.validationPredictions, modelBundle.decisionThreshold]);

  const customerById = useMemo(() => {
    const map = new Map<string, ScoredCustomerRecord>();
    for (const c of customers) {
      map.set(c['Customer ID'], c);
    }
    return map;
  }, [customers]);

  const rocSeries = useMemo(() => {
    const grid = Array.from({ length: 21 }, (_, idx) => Number((idx * 0.05).toFixed(2)));
    const interp = (curve: Array<{ fpr: number; tpr: number }>, targetFpr: number) => {
      let best = 0;
      for (const pt of curve) {
        if (pt.fpr <= targetFpr + 0.001) best = Math.max(best, pt.tpr);
      }
      return Number(best.toFixed(3));
    };
    return grid.map((fpr) => ({
      fpr,
      baseline: fpr,
      gbdtTpr: interp(modelBundle.models.gbdt.rocCurve, fpr),
      logregTpr: interp(modelBundle.models.logreg.rocCurve, fpr),
    }));
  }, [modelBundle]);

  const featureImportance = champion.featureImportance.slice(0, 12);
  const selectedDriver = featureImportance.find((f) => f.feature === selectedDriverKey) ?? null;

  const extractDriverKey = (entry: unknown): string | null => {
    if (!entry || typeof entry !== 'object') return null;
    const rec = entry as Record<string, unknown>;
    if (typeof rec.feature === 'string') return rec.feature;
    if (rec.payload && typeof rec.payload === 'object') {
      const p = rec.payload as Record<string, unknown>;
      if (typeof p.feature === 'string') return p.feature;
    }
    return null;
  };

  const toggleRocSeries = (key: string) => {
    setHiddenRocSeries((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) return prev;
      return [...prev, key];
    });
  };

  const renderRocChart = (heightClass = 'h-[250px] sm:h-[280px]') => (
    <div className={`${heightClass} w-full min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rocSeries} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
          <XAxis
            dataKey="fpr"
            type="number"
            domain={[0, 1]}
            axisLine={{ stroke: palette.axisStroke }}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
          />
          <YAxis
            domain={[0, 1]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: '#C89B3C', strokeWidth: 1, strokeDasharray: '4 4' }}
            content={
              <ChartTooltip
                titleOverride={(label) => `False Positive Rate: ${Number(label ?? 0).toFixed(2)}`}
                rowsBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | { gbdtTpr?: number; logregTpr?: number; baseline?: number }
                    | undefined;
                  const rows = [];
                  if (!hiddenRocSeries.includes('gbdtTpr')) {
                    rows.push({
                      label: `GBDT Stumps (AUC ${modelBundle.models.gbdt.rocAuc.toFixed(3)})`,
                      value: `TPR ${Number(raw?.gbdtTpr ?? 0).toFixed(3)}`,
                      color: palette.navy,
                    });
                  }
                  if (!hiddenRocSeries.includes('logregTpr')) {
                    rows.push({
                      label: `Logistic Reg (AUC ${modelBundle.models.logreg.rocAuc.toFixed(3)})`,
                      value: `TPR ${Number(raw?.logregTpr ?? 0).toFixed(3)}`,
                      color: palette.gold,
                    });
                  }
                  if (!hiddenRocSeries.includes('baseline')) {
                    rows.push({
                      label: 'Random Baseline',
                      value: `TPR ${Number(raw?.baseline ?? 0).toFixed(2)}`,
                      color: palette.axisStroke,
                    });
                  }
                  return rows;
                }}
              />
            }
          />
          {!hiddenRocSeries.includes('baseline') && (
            <Line
              type="linear"
              dataKey="baseline"
              name="Random Baseline"
              stroke={palette.axisStroke}
              strokeDasharray="4 4"
              dot={false}
              strokeWidth={1.5}
            />
          )}
          {!hiddenRocSeries.includes('logregTpr') && (
            <Line
              type="monotone"
              dataKey="logregTpr"
              name={`Logistic Reg (${modelBundle.models.logreg.rocAuc.toFixed(3)})`}
              stroke={palette.gold}
              strokeWidth={2.2}
              dot={false}
              activeDot={{
                r: 6,
                fill: palette.gold,
                stroke: isDark ? '#0B1F3A' : '#FFFFFF',
                strokeWidth: 2,
              }}
            />
          )}
          {!hiddenRocSeries.includes('gbdtTpr') && (
            <Line
              type="monotone"
              dataKey="gbdtTpr"
              name={`GBDT Stumps (${modelBundle.models.gbdt.rocAuc.toFixed(3)})`}
              stroke={palette.navy}
              strokeWidth={2.6}
              dot={false}
              activeDot={{
                r: 6,
                fill: palette.navy,
                stroke: '#C89B3C',
                strokeWidth: 2,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderDriverBars = (heightClass = 'h-[340px] sm:h-[380px]') => (
    <div className={`${heightClass} w-full min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={featureImportance}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            axisLine={{ stroke: palette.axisStroke }}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={165}
            axisLine={false}
            tickLine={false}
            tick={{ fill: palette.labelFill, fontSize: 11, fontWeight: 500 }}
          />
          <Tooltip
            cursor={false}
            content={
              <ChartTooltip
                hint="Click bar to pin driver summary above"
                rowsBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | { importance?: number; direction?: 'risk' | 'protective' }
                    | undefined;
                  return [
                    {
                      label: 'Normalized Weight',
                      value: `${Number(raw?.importance ?? 0).toFixed(1)} / 100`,
                      color: raw?.direction === 'risk' ? palette.crimson : palette.navy,
                    },
                    {
                      label: 'Risk Effect',
                      value: raw?.direction === 'risk' ? 'Increases Churn Risk' : 'Protective Retention Factor',
                      color: palette.gold,
                    },
                  ];
                }}
                noteBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | { feature?: string; label?: string; direction?: 'risk' | 'protective' }
                    | undefined;
                  return explainFeatureDriver(raw?.feature ?? raw?.label ?? '', raw?.direction);
                }}
              />
            }
          />
          <Bar
            dataKey="importance"
            radius={[0, 6, 6, 0]}
            barSize={18}
            onMouseEnter={(_data, idx) => setHoveredDriverIdx(idx)}
            onMouseLeave={() => setHoveredDriverIdx(null)}
            onClick={(entry: unknown) => {
              const k = extractDriverKey(entry);
              if (k) setSelectedDriverKey((prev) => (prev === k ? null : k));
            }}
          >
            {featureImportance.map((item, idx) => {
              const selected = selectedDriverKey === item.feature;
              const hovered = hoveredDriverIdx === idx;
              const dimmedByFilter = selectedDriverKey !== null && !selected;
              const dimmedByHover = hoveredDriverIdx !== null && !hovered;
              const opacity = dimmedByFilter ? 0.28 : dimmedByHover ? 0.65 : 1;
              return (
                <Cell
                  key={item.feature}
                  fill={
                    selected
                      ? palette.gold
                      : item.direction === 'risk'
                      ? palette.crimson
                      : palette.navy
                  }
                  fillOpacity={opacity}
                  stroke={selected ? palette.navy : hovered ? '#C89B3C' : undefined}
                  strokeWidth={selected ? 1.5 : hovered ? 1.5 : 0}
                  style={{
                    cursor: 'pointer',
                    filter: hovered ? 'brightness(1.12)' : undefined,
                    transition: 'opacity 150ms ease, filter 150ms ease',
                  }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header & Champion Selector */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#C89B3C] dark:text-[#E0B44C]" />
            <span className="truncate">
              Stratified {settings.trainSplitRatio}/{100 - settings.trainSplitRatio} Split ·{' '}
              {formatNumber(modelBundle.trainRowCount)} train /{' '}
              {formatNumber(modelBundle.validationRowCount)} validation · Seed {settings.randomSeed}
            </span>
          </div>
          <h2 className="mt-1 font-display text-base sm:text-lg font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
            Active Champion: {champion.name}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Last trained {formatTimestamp(modelBundle.trainedAt)} · Validation Churn Rate{' '}
            {formatPercent(modelBundle.positiveRateTrain * 100)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-[#F1F5F9] dark:bg-[#132847] p-1">
            {modelsList.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectChampion(m.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                  modelBundle.championModelId === m.id
                    ? 'bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16] shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                {m.id === 'gbdt' ? 'GBDT Stumps' : 'L2 LogReg'}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isRetraining}
            onClick={onRetrain}
            className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-xl bg-[#C89B3C] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] disabled:opacity-50 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
            <span>Retrain Models</span>
          </button>
        </div>
      </section>

      {/* Sub-Navigation Tabs (Touch-Scrollable Rail) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] pb-3">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <div className="inline-flex rounded-xl bg-[#E2E8F0]/60 dark:bg-[#132847] p-1 gap-1">
            {(
              [
                { id: 'optimizer', label: 'ROC, Confusion Matrix & ROI', icon: Activity },
                { id: 'benchmarks', label: 'Model Benchmarks', icon: BarChart3 },
                { id: 'drivers', label: 'Feature Drivers', icon: GitBranch },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                    active
                      ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono tabular-nums">
          ROI Assumptions: {settings.expectedRetentionRatePct}% save rate · {settings.revenueHorizonMonths}m horizon
        </div>
      </div>

      {/* TAB 1: BENCHMARKS */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-5">
          {/* Interactive Model Cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modelsList.map((m) => {
              const isChamp = modelBundle.championModelId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectChampion(m.id)}
                  className={`group/model relative overflow-hidden text-left rounded-2xl border bg-white dark:bg-[#0D1E36] p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                    isChamp
                      ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
                      : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C]'
                  }`}
                >
                  {isChamp && (
                    <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#0B1F3A] to-[#C89B3C]" />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                        {m.name}
                      </div>
                      <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
                        {m.algorithmDescription}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
                        isChamp
                          ? 'bg-[#FFFBEB] dark:bg-[#E0B44C]/15 text-[#B4821E] dark:text-[#E0B44C]'
                          : 'bg-[#F1F5F9] dark:bg-[#132847] text-[#64748B] dark:text-[#94A3B8] group-hover/model:text-[#C89B3C]'
                      }`}
                    >
                      {isChamp && <Award className="h-3 w-3" />}
                      {isChamp ? 'Active Champion' : 'Click to Activate'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-3 border-t border-[#F1F5F9] dark:border-[#1E3A5F] pt-3 text-xs">
                    <div>
                      <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">ROC-AUC</div>
                      <div className="font-mono font-bold text-[#0B1F3A] dark:text-[#E0B44C] tabular-nums">
                        {m.rocAuc.toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">PR-AUC</div>
                      <div className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                        {m.prAuc.toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">F1 Score</div>
                      <div className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                        {m.f1Score.toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Log Loss</div>
                      <div className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                        {m.logLoss.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-sm overflow-hidden">
            <div className="border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-3.5">
              <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                Validation Benchmark Comparison
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Evaluated out-of-sample on {formatNumber(modelBundle.validationRowCount)} held-out UK subscriber records
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#F8FAFC] dark:bg-[#132847] px-5 py-3 font-semibold whitespace-nowrap">
                      Model Architecture
                    </th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">ROC-AUC</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">PR-AUC</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Accuracy</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Precision</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Recall</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">F1-Score</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Log Loss</th>
                    <th className="px-5 py-3 font-semibold text-right whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                  {modelsList.map((m) => {
                    const isChamp = modelBundle.championModelId === m.id;
                    return (
                      <tr
                        key={m.id}
                        onClick={() => onSelectChampion(m.id)}
                        className={`cursor-pointer transition-colors ${
                          isChamp
                            ? 'bg-[#FFFBEB]/50 dark:bg-[#132847]'
                            : 'hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60'
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-white dark:bg-[#0D1E36] px-5 py-3.5 min-w-[200px]">
                          <div className="font-semibold text-[#0B1F3A] dark:text-[#F8FAFC]">{m.name}</div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate max-w-[260px]">
                            {m.algorithmDescription}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#0B1F3A] dark:text-[#E0B44C] tabular-nums">
                          {m.rocAuc.toFixed(3)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                          {m.prAuc.toFixed(3)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatPercent(m.accuracy * 100)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatPercent(m.precision * 100)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatPercent(m.recall * 100)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                          {m.f1Score.toFixed(3)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                          {m.logLoss.toFixed(3)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {isChamp ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#B4821E] dark:text-[#E0B44C]">
                              <Award className="h-3.5 w-3.5" /> Champion
                            </span>
                          ) : (
                            <span className="text-[#64748B] dark:text-[#94A3B8]">Challenger</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: ROC & THRESHOLD OPTIMIZER + INTERACTIVE CONFUSION MATRIX */}
      {activeTab === 'optimizer' && (
        <div className="space-y-5">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <ChartCard
              className="lg:col-span-6"
              title="Receiver Operating Characteristic (ROC Curve)"
              subtitle="True Positive Rate vs. False Positive Rate across thresholds · Click legend to toggle curves"
              exportData={rocSeries as unknown as Array<Record<string, unknown>>}
              exportFilename="roc_curve_comparison"
              renderExpanded={() => renderRocChart('h-full')}
              footer={
                <div className="pt-1">
                  <InteractiveLegend
                    items={[
                      {
                        key: 'gbdtTpr',
                        label: `GBDT Stumps (AUC ${modelBundle.models.gbdt.rocAuc.toFixed(3)})`,
                        color: palette.navy,
                      },
                      {
                        key: 'logregTpr',
                        label: `Logistic Regression (AUC ${modelBundle.models.logreg.rocAuc.toFixed(3)})`,
                        color: palette.gold,
                      },
                      {
                        key: 'baseline',
                        label: 'Random Baseline (0.500)',
                        color: palette.axisStroke,
                      },
                    ]}
                    hiddenKeys={hiddenRocSeries}
                    onToggle={toggleRocSeries}
                  />
                </div>
              }
            >
              {renderRocChart()}
            </ChartCard>

            {/* Threshold Optimizer & Clickable Confusion Matrix */}
            <div className="lg:col-span-6 min-w-0 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                      Decision Threshold & Interactive Confusion Matrix
                    </h3>
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                      Tune threshold or click any 2×2 cell to inspect validation accounts below
                    </p>
                  </div>
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#C89B3C] dark:text-[#E0B44C]" />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-[#F8FAFC] dark:bg-[#132847] p-3.5 border border-[#E2E8F0] dark:border-[#1E3A5F]">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Decision Threshold</span>
                      <span className="font-mono font-bold text-[#0B1F3A] dark:text-[#E0B44C] tabular-nums">
                        {(modelBundle.decisionThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={0.9}
                      step={0.02}
                      value={modelBundle.decisionThreshold}
                      onChange={(e) => onUpdateThreshold(Number(e.target.value))}
                      className="w-full accent-[#0B1F3A] dark:accent-[#E0B44C] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                      <span>10% (High Recall)</span>
                      <span>90% (High Precision)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Offer Cost / Flagged</span>
                      <span className="font-mono font-bold text-[#0B1F3A] dark:text-[#E0B44C] tabular-nums">
                        {formatGBP(offerCost)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={1}
                      value={offerCost}
                      onChange={(e) => setOfferCost(Number(e.target.value))}
                      className="w-full accent-[#C89B3C] dark:accent-[#E0B44C] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                      <span>£5</span>
                      <span>£100</span>
                    </div>
                  </div>
                </div>

                {/* Clickable Confusion Matrix 2x2 */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  {(
                    [
                      {
                        key: 'TP',
                        label: 'True Positives (Caught Churn)',
                        count: thresholdMetrics.matrix.tp,
                        tone: 'text-[#16325C] dark:text-[#4B7BEC]',
                      },
                      {
                        key: 'FP',
                        label: 'False Positives (Over-Targeted)',
                        count: thresholdMetrics.matrix.fp,
                        tone: 'text-[#B4821E] dark:text-[#E0B44C]',
                      },
                      {
                        key: 'FN',
                        label: 'False Negatives (Missed Churn)',
                        count: thresholdMetrics.matrix.fn,
                        tone: 'text-[#8B1E24] dark:text-[#C93842]',
                      },
                      {
                        key: 'TN',
                        label: 'True Negatives (Correct Active)',
                        count: thresholdMetrics.matrix.tn,
                        tone: 'text-[#0F172A] dark:text-[#F8FAFC]',
                      },
                    ] as const
                  ).map((cell) => {
                    const active = crossFilters.confusionBucket === cell.key;
                    const dimmed =
                      crossFilters.confusionBucket !== 'All' && !active;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setConfusionBucket(cell.key)}
                        className={`group/cell relative rounded-xl border p-3.5 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                          active
                            ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C] bg-[#FFFBEB]/60 dark:bg-[#132847]'
                            : 'border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] hover:border-[#C89B3C]'
                        } ${dimmed ? 'opacity-50' : 'opacity-100'}`}
                      >
                        <ArrowRight className="absolute right-2.5 top-2.5 h-3 w-3 text-[#94A3B8] opacity-0 group-hover/cell:opacity-100 group-hover/cell:text-[#C89B3C] transition-all" />
                        <div className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] pr-3">
                          {cell.label}
                        </div>
                        <div className={`mt-1 font-display text-xl font-bold tabular-nums ${cell.tone}`}>
                          {cell.count}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#F1F5F9] dark:border-[#1E3A5F] pt-3 text-xs">
                <div>
                  <div className="text-[#64748B] dark:text-[#94A3B8]">Precision / Recall</div>
                  <div className="font-mono font-semibold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                    {formatPercent(thresholdMetrics.precision * 100)} / {formatPercent(thresholdMetrics.recall * 100)}
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B] dark:text-[#94A3B8]">Flagged Cohort</div>
                  <div className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                    {thresholdMetrics.flaggedCount} accounts
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B] dark:text-[#94A3B8]">Offer Cost (Val)</div>
                  <div className="font-mono font-semibold text-[#8B1E24] dark:text-[#C93842] tabular-nums">
                    {formatCurrencyDisplay(thresholdMetrics.projectedOfferCostGBP, settings.compactCurrency)}
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B] dark:text-[#94A3B8]">Projected Net Saved</div>
                  <div
                    className={`font-mono font-bold tabular-nums ${
                      thresholdMetrics.projectedNetBenefitGBP >= 0
                        ? 'text-[#16325C] dark:text-[#4B7BEC]'
                        : 'text-[#8B1E24] dark:text-[#C93842]'
                    }`}
                  >
                    {formatCurrencyDisplay(thresholdMetrics.projectedNetBenefitGBP, settings.compactCurrency)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Live Validation Cohort Preview triggered by Confusion Matrix Cell Click */}
          {crossFilters.confusionBucket !== 'All' && (
            <section className="rounded-2xl border border-[#C89B3C]/60 dark:border-[#E0B44C]/60 bg-white dark:bg-[#0D1E36] shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-5 py-3.5 bg-[#FFFBEB]/50 dark:bg-[#132847]">
                <div>
                  <h4 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#E0B44C]">
                    Validation Cohort Preview · {crossFilters.confusionBucket} ({selectedConfusionRows.length} accounts)
                  </h4>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                    Held-out validation records classified into {crossFilters.confusionBucket} at{' '}
                    {(modelBundle.decisionThreshold * 100).toFixed(0)}% threshold
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfusionBucket('All')}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Close Preview
                </button>
              </div>

              <div className="overflow-x-auto max-h-[340px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                    <tr>
                      <th className="sticky left-0 z-10 bg-[#F8FAFC] dark:bg-[#132847] px-4 py-2.5 font-semibold whitespace-nowrap">
                        Customer ID
                      </th>
                      <th className="px-4 py-2.5 font-semibold whitespace-nowrap">City & Plan</th>
                      <th className="px-4 py-2.5 font-semibold text-right whitespace-nowrap">Monthly Charge</th>
                      <th className="px-4 py-2.5 font-semibold text-right whitespace-nowrap">Model Risk %</th>
                      <th className="px-4 py-2.5 font-semibold text-right whitespace-nowrap">Actual Outcome</th>
                      <th className="px-4 py-2.5 font-semibold text-right whitespace-nowrap">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                    {selectedConfusionRows.slice(0, 40).map((item) => {
                      const matchedCustomer = item.customerId
                        ? customerById.get(item.customerId)
                        : undefined;
                      return (
                        <tr
                          key={`${item.customerId ?? 'val'}-${item.idx}`}
                          className="hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60"
                        >
                          <td className="sticky left-0 z-10 bg-white dark:bg-[#0D1E36] px-4 py-2 font-mono font-semibold text-[#0B1F3A] dark:text-[#E0B44C] whitespace-nowrap">
                            {item.customerId ?? `Val #${item.idx + 1}`}
                          </td>
                          <td className="px-4 py-2 text-[#334155] dark:text-[#CBD5E1] whitespace-nowrap">
                            {item.city ? `${item.city} · ${item.planName ?? ''}` : 'Retrain models to view full IDs'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                            {formatGBP(item.monthlyCharge, 2)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums text-[#8B1E24] dark:text-[#C93842]">
                            {formatPercent(item.probability * 100)}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <span
                              className={`font-medium ${
                                item.actual === 1
                                  ? 'text-[#8B1E24] dark:text-[#C93842]'
                                  : 'text-[#16325C] dark:text-[#4B7BEC]'
                              }`}
                            >
                              {item.actual === 1 ? 'Churned' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            {matchedCustomer ? (
                              <button
                                type="button"
                                onClick={() => onSelectCustomer(matchedCustomer)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2.5 py-1 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#C89B3C] cursor-pointer"
                              >
                                <Eye className="h-3 w-3" /> 360°
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#94A3B8]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 3: GLOBAL FEATURE IMPORTANCE */}
      {activeTab === 'drivers' && (
        <ChartCard
          title={`Global Churn Driver Importance (${champion.name})`}
          subtitle="Hover any bar for plain-English rationale · Click to pin importance details"
          isFiltered={selectedDriverKey !== null}
          onClearFilter={() => {
            setSelectedDriverKey(null);
            notify('Cleared pinned feature highlight.', 'info');
          }}
          exportData={featureImportance as unknown as Array<Record<string, unknown>>}
          exportFilename="global_feature_drivers"
          headerRight={
            <div className="flex items-center gap-4 text-[11px] text-[#475569] dark:text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: palette.crimson }} /> Increases Risk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: palette.navy }} /> Protective
              </span>
            </div>
          }
          renderExpanded={() => renderDriverBars('h-full')}
        >
          {selectedDriver && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C89B3C]/60 dark:border-[#E0B44C]/60 bg-[#FFFBEB]/60 dark:bg-[#132847] px-4 py-2.5 text-xs">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#0B1F3A] dark:text-[#E0B44C]">
                    {selectedDriver.label}
                  </span>
                  <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                    · Normalized Importance: {selectedDriver.importance.toFixed(1)} / 100
                  </span>
                </div>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  {explainFeatureDriver(selectedDriver.feature, selectedDriver.direction)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDriverKey(null)}
                className="text-[11px] font-medium text-[#8B1E24] dark:text-[#C93842] hover:underline cursor-pointer"
              >
                Clear highlight
              </button>
            </div>
          )}

          {renderDriverBars()}
        </ChartCard>
      )}
    </div>
  );
};
