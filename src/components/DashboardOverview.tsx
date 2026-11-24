import React, { useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  RotateCcw,
  Users,
  AlertTriangle,
  TrendingDown,
  ShieldAlert,
  HeartHandshake,
  Clock,
  ArrowUpRight,
  ArrowRight,
  Filter,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import type {
  DatasetMetadata,
  GlobalFilters,
  PlatformSettings,
  ScoredCustomerRecord,
} from '../types/britconnect';
import { applyGlobalFilters, computeDashboardCharts, computeDashboardKPIs } from '../utils/analytics';
import { isContractExpiringSoon } from '../utils/alerts';
import {
  formatCurrencyDisplay,
  formatGBP,
  formatGBPCompact,
  formatNumber,
  formatPercent,
  safeDivide,
} from '../utils/formatters';
import { getChartThemePalette } from '../utils/settings';
import { useCrossFilter } from '../context/CrossFilterContext';
import { useToast } from '../context/ToastContext';
import { ActiveCrossFilterBar } from './ActiveCrossFilterBar';
import {
  ChartCard,
  ChartTooltip,
  InteractiveLegend,
  renderExpandedPieSector,
} from './ChartUI';

interface DashboardOverviewProps {
  customers: ScoredCustomerRecord[];
  filters: GlobalFilters;
  settings: PlatformSettings;
  isDark: boolean;
  datasetMetadata?: DatasetMetadata;
  onChangeFilters: (next: GlobalFilters) => void;
  onResetFilters: () => void;
  onNavigateToCustomers: (riskTier?: string) => void;
  onOpenCopilot?: () => void;
  onTriggerUpload?: () => void;
}

const FILTER_LABELS: Record<keyof GlobalFilters, string> = {
  ukNation: 'UK Nation',
  customerSegment: 'Segment',
  serviceType: 'Service',
  contractType: 'Contract',
  planName: 'Plan',
  riskTier: 'Risk Tier',
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  customers,
  filters,
  settings,
  isDark,
  datasetMetadata,
  onChangeFilters,
  onResetFilters,
  onNavigateToCustomers,
  onOpenCopilot,
  onTriggerUpload,
}) => {
  const [breakdownMode, setBreakdownMode] = useState<'contract' | 'service'>('contract');
  const [donutMode, setDonutMode] = useState<'tier' | 'segment'>('tier');
  const [hiddenBreakdownSeries, setHiddenBreakdownSeries] = useState<string[]>([]);

  // Smooth per-chart hover tracking (replaces ugly grey BarChart hover backdrop)
  const [hoveredBreakdownIdx, setHoveredBreakdownIdx] = useState<number | null>(null);
  const [hoveredNationIdx, setHoveredNationIdx] = useState<number | null>(null);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState<number | null>(null);
  const [hoveredProbIdx, setHoveredProbIdx] = useState<number | null>(null);

  const palette = useMemo(() => getChartThemePalette(isDark), [isDark]);
  const { notify } = useToast();

  // Captures modifier key state right before Recharts SVG onClick fires
  const modifierStateRef = useRef<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>({
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  });

  const captureModifiers = (e: React.MouseEvent) => {
    modifierStateRef.current = {
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
    };
  };

  const {
    crossFilters,
    multiSelectEnabled,
    setMultiSelectEnabled,
    toggleDimension,
    toggleHighCriticalRisk,
    toggleChurnStatus,
    toggleExpiringSoon,
    clearDimension,
    clearAllCrossFilters,
    activeCustomerChips,
    filterCustomers,
    isDimensionSelected,
    hasDimensionFilter,
  } = useCrossFilter();

  const filterOptions = useMemo(() => {
    const uniq = (fn: (c: ScoredCustomerRecord) => string) =>
      ['All', ...Array.from(new Set(customers.map(fn))).filter(Boolean).sort()];
    return {
      nations: uniq((c) => c['UK Nation']),
      segments: uniq((c) => c['Customer Segment']),
      services: uniq((c) => c['Service Type']),
      contracts: uniq((c) => c['Contract Type']),
      plans: uniq((c) => c['Plan Name']),
      tiers: ['All', 'Critical', 'High', 'Medium', 'Low'],
    };
  }, [customers]);

  const scopeFiltered = useMemo(() => applyGlobalFilters(customers, filters), [customers, filters]);

  const filtered = useMemo(
    () => filterCustomers(customers, filters, settings),
    [customers, filters, settings, filterCustomers]
  );

  // Power BI Self-Chart Preservation
  const contractOrServiceRows = useMemo(
    () =>
      filterCustomers(customers, filters, settings, [
        breakdownMode === 'contract' ? 'contractType' : 'serviceType',
      ]),
    [customers, filters, settings, filterCustomers, breakdownMode]
  );

  const nationRows = useMemo(
    () => filterCustomers(customers, filters, settings, ['ukNation']),
    [customers, filters, settings, filterCustomers]
  );

  const donutRows = useMemo(
    () =>
      filterCustomers(customers, filters, settings, [
        donutMode === 'tier' ? 'riskTier' : 'customerSegment',
      ]),
    [customers, filters, settings, filterCustomers, donutMode]
  );

  const probHistRows = useMemo(
    () => filterCustomers(customers, filters, settings, ['probBucket']),
    [customers, filters, settings, filterCustomers]
  );

  const churnReasonRows = useMemo(
    () => filterCustomers(customers, filters, settings, ['churnReason']),
    [customers, filters, settings, filterCustomers]
  );

  const tenureRows = useMemo(
    () => filterCustomers(customers, filters, settings, ['tenureCohort']),
    [customers, filters, settings, filterCustomers]
  );

  const monthlyTrendRows = useMemo(
    () => filterCustomers(customers, filters, settings, ['monthlyTrendMonth']),
    [customers, filters, settings, filterCustomers]
  );

  const kpis = useMemo(() => computeDashboardKPIs(filtered), [filtered]);
  const expiringCount = useMemo(
    () => filtered.filter((r) => isContractExpiringSoon(r, settings)).length,
    [filtered, settings]
  );

  const charts = useMemo(() => computeDashboardCharts(filtered), [filtered]);
  const contractOrServiceCharts = useMemo(
    () => computeDashboardCharts(contractOrServiceRows),
    [contractOrServiceRows]
  );
  const nationCharts = useMemo(() => computeDashboardCharts(nationRows), [nationRows]);
  const donutCharts = useMemo(() => computeDashboardCharts(donutRows), [donutRows]);
  const probCharts = useMemo(() => computeDashboardCharts(probHistRows), [probHistRows]);
  const reasonCharts = useMemo(() => computeDashboardCharts(churnReasonRows), [churnReasonRows]);
  const tenureCharts = useMemo(() => computeDashboardCharts(tenureRows), [tenureRows]);
  const monthlyCharts = useMemo(() => computeDashboardCharts(monthlyTrendRows), [monthlyTrendRows]);

  const segmentDonutData = useMemo(() => {
    const map = new Map<string, { count: number; revRisk: number }>();
    for (const r of donutRows) {
      const cur = map.get(r['Customer Segment']) ?? { count: 0, revRisk: 0 };
      cur.count++;
      cur.revRisk += r.predictedMonthlyRevenueAtRisk;
      map.set(r['Customer Segment'], cur);
    }
    const total = Math.max(1, donutRows.length);
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        count: v.count,
        sharePct: Number((safeDivide(v.count, total) * 100).toFixed(1)),
        revRiskGBP: Math.round(v.revRisk),
      }))
      .sort((a, b) => b.count - a.count);
  }, [donutRows]);

  // Dynamic 1-line executive insight computed from filtered data
  const executiveInsight = useMemo(() => {
    if (filtered.length === 0) {
      return 'No subscribers match the active filter combination. Reset filters to restore portfolio telemetry.';
    }
    const topNation = charts.byNation[0];
    const m2m = charts.byContract.find((c) => c.name.toLowerCase().includes('month'));
    if (topNation && m2m) {
      return `${topNation.name} carries the highest monthly exposure (${formatCurrencyDisplay(
        topNation.revRiskGBP,
        settings.compactCurrency
      )}/mo), while ${m2m.name} contracts average ${formatPercent(m2m.churnRatePct)} churn.`;
    }
    if (topNation) {
      return `${topNation.name} leads regional exposure at ${formatCurrencyDisplay(
        topNation.revRiskGBP,
        settings.compactCurrency
      )}/mo across ${formatNumber(topNation.customers)} subscribers.`;
    }
    return `${formatNumber(kpis.highCriticalRiskCount)} High & Critical accounts represent ${formatCurrencyDisplay(
      kpis.predictedMonthlyRevenueAtRiskGBP,
      settings.compactCurrency
    )}/mo in model-weighted risk.`;
  }, [filtered.length, charts.byNation, charts.byContract, kpis, settings.compactCurrency]);

  const activeFilterEntries = (Object.entries(filters) as Array<[keyof GlobalFilters, string]>).filter(
    ([, v]) => v !== 'All'
  );
  const hasActiveFilter = activeFilterEntries.length > 0;

  const isHighCritKpiActive =
    crossFilters.riskTier.length === 2 &&
    crossFilters.riskTier.includes('Critical') &&
    crossFilters.riskTier.includes('High');

  const isChurnRateKpiActive = crossFilters.churnStatus === 'Churned';
  const isExpiringKpiActive = crossFilters.expiringSoon;

  const tierColors: Record<string, string> = {
    Critical: palette.crimson,
    High: palette.crimsonSoft,
    Medium: palette.gold,
    Low: palette.slateNavy,
  };

  const segmentColors = [palette.navy, palette.gold, palette.crimson, palette.slateNavy];

  const contractOrServiceData =
    breakdownMode === 'contract' ? contractOrServiceCharts.byContract : contractOrServiceCharts.byService;

  const activeBreakdownDim = breakdownMode === 'contract' ? 'contractType' : 'serviceType';
  const hasBreakdownFilter = hasDimensionFilter(activeBreakdownDim);
  const hasNationFilter = hasDimensionFilter('ukNation');
  const hasProbFilter = hasDimensionFilter('probBucket');
  const hasReasonFilter = hasDimensionFilter('churnReason');
  const hasTenureFilter = hasDimensionFilter('tenureCohort');
  const hasMonthlyTrendFilter = hasDimensionFilter('monthlyTrendMonth');
  const activeDonutDim = donutMode === 'tier' ? 'riskTier' : 'customerSegment';
  const hasDonutFilter = hasDimensionFilter(activeDonutDim);

  const donutList: Array<{
    name: string;
    count: number;
    sharePct: number;
    revRiskGBP: number;
    color: string;
  }> =
    donutMode === 'tier'
      ? donutCharts.riskTierComposition.map((t) => ({
          name: t.tier,
          count: t.count,
          sharePct: t.sharePct,
          revRiskGBP: t.revRiskGBP,
          color: tierColors[t.tier],
        }))
      : segmentDonutData.map((s, idx) => ({
          name: s.name,
          count: s.count,
          sharePct: s.sharePct,
          revRiskGBP: s.revRiskGBP,
          color: segmentColors[idx % segmentColors.length],
        }));

  const hoveredDonutItem =
    hoveredDonutIdx !== null && donutList[hoveredDonutIdx] ? donutList[hoveredDonutIdx] : null;
  const totalDonutCount = donutRows.length;

  const extractRechartsLabel = (
    item: unknown,
    fallbackKey: 'name' | 'bucket' | 'cohort' | 'month'
  ): string | null => {
    if (!item || typeof item !== 'object') return null;
    const rec = item as Record<string, unknown>;
    const direct = rec[fallbackKey] ?? rec.name;
    if (typeof direct === 'string' && direct.length > 0) return direct;
    if (rec.payload && typeof rec.payload === 'object') {
      const p = rec.payload as Record<string, unknown>;
      const nested = p[fallbackKey] ?? p.name;
      if (typeof nested === 'string' && nested.length > 0) return nested;
    }
    return null;
  };

  const toggleBreakdownSeries = (key: string) => {
    setHiddenBreakdownSeries((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 1) return prev; // Keep at least one series visible
      return [...prev, key];
    });
  };

  const showChurnRateBar = !hiddenBreakdownSeries.includes('churnRatePct');
  const showVolumeBar = !hiddenBreakdownSeries.includes('customers');

  const renderBreakdownChart = (heightClass = 'h-[245px] sm:h-[265px]') => (
    <div className={`${heightClass} w-full min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={contractOrServiceData} margin={{ top: 10, right: 12, left: -14, bottom: 4 }}>
          <XAxis
            dataKey="name"
            axisLine={{ stroke: palette.axisStroke }}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
          />
          <Tooltip
            cursor={false}
            content={
              <ChartTooltip
                hint={`Click bar to cross-filter by ${
                  breakdownMode === 'contract' ? 'Contract Type' : 'Service Type'
                }`}
                rowsBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | {
                        churnRatePct?: number;
                        customers?: number;
                        sharePct?: number;
                        revRiskGBP?: number;
                      }
                    | undefined;
                  return [
                    {
                      label: 'Churn Rate',
                      value: `${Number(raw?.churnRatePct ?? 0).toFixed(1)}%`,
                      color: palette.crimson,
                    },
                    {
                      label: 'Subscribers',
                      value: `${formatNumber(Number(raw?.customers ?? 0))} (${Number(
                        raw?.sharePct ?? 0
                      ).toFixed(1)}%)`,
                      color: palette.navy,
                    },
                    {
                      label: 'Monthly Rev at Risk',
                      value: formatGBP(Number(raw?.revRiskGBP ?? 0)),
                      color: palette.gold,
                    },
                  ];
                }}
              />
            }
          />
          {showChurnRateBar && (
            <Bar
              yAxisId="left"
              dataKey="churnRatePct"
              name="Churn Rate (%)"
              radius={[6, 6, 0, 0]}
              barSize={28}
              onMouseEnter={(_data, idx) => setHoveredBreakdownIdx(idx)}
              onMouseLeave={() => setHoveredBreakdownIdx(null)}
              onClick={(entry: unknown) => {
                const label = extractRechartsLabel(entry, 'name');
                if (label) toggleDimension(activeBreakdownDim, label, modifierStateRef.current);
              }}
            >
              {contractOrServiceData.map((entry, idx) => {
                const selected = isDimensionSelected(activeBreakdownDim, entry.name);
                const hovered = hoveredBreakdownIdx === idx;
                const dimmedByFilter = hasBreakdownFilter && !selected;
                const dimmedByHover = hoveredBreakdownIdx !== null && !hovered;
                const opacity = dimmedByFilter ? 0.28 : dimmedByHover ? 0.65 : 1;
                return (
                  <Cell
                    key={entry.name}
                    fill={palette.crimson}
                    fillOpacity={opacity}
                    stroke={hovered || selected ? palette.gold : undefined}
                    strokeWidth={selected ? 2 : hovered ? 1.5 : 0}
                    style={{
                      cursor: 'pointer',
                      filter: hovered ? 'brightness(1.12)' : undefined,
                      transition: 'opacity 150ms ease, filter 150ms ease',
                    }}
                  />
                );
              })}
            </Bar>
          )}
          {showVolumeBar && (
            <Bar
              yAxisId="right"
              dataKey="customers"
              name="Subscribers"
              radius={[6, 6, 0, 0]}
              barSize={28}
              onMouseEnter={(_data, idx) => setHoveredBreakdownIdx(idx)}
              onMouseLeave={() => setHoveredBreakdownIdx(null)}
              onClick={(entry: unknown) => {
                const label = extractRechartsLabel(entry, 'name');
                if (label) toggleDimension(activeBreakdownDim, label, modifierStateRef.current);
              }}
            >
              {contractOrServiceData.map((entry, idx) => {
                const selected = isDimensionSelected(activeBreakdownDim, entry.name);
                const hovered = hoveredBreakdownIdx === idx;
                const dimmedByFilter = hasBreakdownFilter && !selected;
                const dimmedByHover = hoveredBreakdownIdx !== null && !hovered;
                const opacity = dimmedByFilter ? 0.28 : dimmedByHover ? 0.65 : 1;
                return (
                  <Cell
                    key={entry.name}
                    fill={palette.navy}
                    fillOpacity={opacity}
                    stroke={hovered || selected ? palette.gold : undefined}
                    strokeWidth={selected ? 2 : hovered ? 1.5 : 0}
                    style={{
                      cursor: 'pointer',
                      filter: hovered ? 'brightness(1.12)' : undefined,
                      transition: 'opacity 150ms ease, filter 150ms ease',
                    }}
                  />
                );
              })}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderNationChart = (heightClass = 'h-[195px] sm:h-[205px]') => (
    <div className={`${heightClass} w-full min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={nationCharts.byNation}
          layout="vertical"
          margin={{ top: 4, right: 18, left: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            axisLine={{ stroke: palette.axisStroke }}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
            tickFormatter={(v) => formatGBPCompact(Number(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={102}
            tick={{ fill: palette.labelFill, fontSize: 11, fontWeight: 500 }}
          />
          <Tooltip
            cursor={false}
            content={
              <ChartTooltip
                hint="Click bar to cross-filter UK Nation"
                rowsBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | {
                        revRiskGBP?: number;
                        sharePct?: number;
                        customers?: number;
                        churnRatePct?: number;
                      }
                    | undefined;
                  return [
                    {
                      label: 'Monthly Rev at Risk',
                      value: formatGBP(Number(raw?.revRiskGBP ?? 0)),
                      color: palette.gold,
                    },
                    {
                      label: 'Share of UK Exposure',
                      value: `${Number(raw?.sharePct ?? 0).toFixed(1)}%`,
                      color: palette.navy,
                    },
                    {
                      label: 'Subscribers · Churn',
                      value: `${formatNumber(Number(raw?.customers ?? 0))} · ${Number(
                        raw?.churnRatePct ?? 0
                      ).toFixed(1)}%`,
                      color: palette.crimson,
                    },
                  ];
                }}
              />
            }
          />
          <Bar
            dataKey="revRiskGBP"
            radius={[0, 6, 6, 0]}
            barSize={20}
            onMouseEnter={(_data, idx) => setHoveredNationIdx(idx)}
            onMouseLeave={() => setHoveredNationIdx(null)}
            onClick={(entry: unknown) => {
              const label = extractRechartsLabel(entry, 'name');
              if (label) toggleDimension('ukNation', label, modifierStateRef.current);
            }}
          >
            {nationCharts.byNation.map((entry, idx) => {
              const selected = isDimensionSelected('ukNation', entry.name);
              const hovered = hoveredNationIdx === idx;
              const dimmedByFilter = hasNationFilter && !selected;
              const dimmedByHover = hoveredNationIdx !== null && !hovered;
              const opacity = dimmedByFilter ? 0.28 : dimmedByHover ? 0.65 : 1;
              return (
                <Cell
                  key={entry.name}
                  fill={palette.gold}
                  fillOpacity={opacity}
                  stroke={selected ? palette.navy : hovered ? '#C89B3C' : undefined}
                  strokeWidth={selected ? 2 : hovered ? 1.5 : 0}
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

  const renderProbChart = (heightClass = 'h-[205px] sm:h-[215px]') => (
    <div className={`${heightClass} w-full min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={probCharts.probabilityHistogram}
          margin={{ top: 8, right: 8, left: -18, bottom: 2 }}
        >
          <XAxis
            dataKey="bucket"
            axisLine={{ stroke: palette.axisStroke }}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 10 }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: palette.tickFill, fontSize: 11 }} />
          <Tooltip
            cursor={false}
            content={
              <ChartTooltip
                hint="Click band to filter accounts by probability"
                rowsBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | { customers?: number; sharePct?: number; revRiskGBP?: number }
                    | undefined;
                  return [
                    {
                      label: 'Subscribers',
                      value: `${formatNumber(Number(raw?.customers ?? 0))} (${Number(
                        raw?.sharePct ?? 0
                      ).toFixed(1)}%)`,
                      color: palette.navy,
                    },
                    {
                      label: 'Monthly Rev at Risk',
                      value: formatGBP(Number(raw?.revRiskGBP ?? 0)),
                      color: palette.crimson,
                    },
                  ];
                }}
              />
            }
          />
          <Bar
            dataKey="customers"
            radius={[6, 6, 0, 0]}
            barSize={26}
            onMouseEnter={(_data, idx) => setHoveredProbIdx(idx)}
            onMouseLeave={() => setHoveredProbIdx(null)}
            onClick={(entry: unknown) => {
              const label = extractRechartsLabel(entry, 'bucket');
              if (label) toggleDimension('probBucket', label, modifierStateRef.current);
            }}
          >
            {probCharts.probabilityHistogram.map((entry, idx) => {
              const selected = isDimensionSelected('probBucket', entry.bucket);
              const hovered = hoveredProbIdx === idx;
              const dimmedByFilter = hasProbFilter && !selected;
              const dimmedByHover = hoveredProbIdx !== null && !hovered;
              const opacity = dimmedByFilter ? 0.28 : dimmedByHover ? 0.65 : 1;
              return (
                <Cell
                  key={entry.bucket}
                  fill={idx >= 4 ? palette.crimson : idx >= 2 ? palette.gold : palette.slateNavy}
                  fillOpacity={opacity}
                  stroke={hovered || selected ? palette.gold : undefined}
                  strokeWidth={selected ? 2 : hovered ? 1.5 : 0}
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

  const renderTenureChart = (heightClass = 'h-[220px] sm:h-[235px]') => (
    <div className={`${heightClass} w-full min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={tenureCharts.tenureCurve}
          margin={{ top: 10, right: 16, left: -14, bottom: 2 }}
          onClick={(state: unknown) => {
            const label = (state as { activeLabel?: string } | null)?.activeLabel;
            if (typeof label === 'string' && label.length > 0) {
              toggleDimension('tenureCohort', label, modifierStateRef.current);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id="navyCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.navy} stopOpacity={0.28} />
              <stop offset="95%" stopColor={palette.navy} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="cohort"
            axisLine={{ stroke: palette.axisStroke }}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ stroke: '#C89B3C', strokeWidth: 1, strokeDasharray: '4 4' }}
            content={
              <ChartTooltip
                hint="Click cohort point or button below to cross-filter"
                rowsBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | {
                        churnRatePct?: number;
                        customers?: number;
                        sharePct?: number;
                        revRiskGBP?: number;
                      }
                    | undefined;
                  return [
                    {
                      label: 'Cohort Churn Rate',
                      value: `${Number(raw?.churnRatePct ?? 0).toFixed(1)}%`,
                      color: palette.crimson,
                    },
                    {
                      label: 'Subscribers',
                      value: `${formatNumber(Number(raw?.customers ?? 0))} (${Number(
                        raw?.sharePct ?? 0
                      ).toFixed(1)}%)`,
                      color: palette.navy,
                    },
                    {
                      label: 'Monthly Rev at Risk',
                      value: formatGBP(Number(raw?.revRiskGBP ?? 0)),
                      color: palette.gold,
                    },
                  ];
                }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="churnRatePct"
            stroke={palette.navy}
            strokeWidth={2.5}
            fill="url(#navyCurveFill)"
            dot={{ r: 4, fill: palette.gold, stroke: palette.navy, strokeWidth: 1.5 }}
            activeDot={{
              r: 6,
              fill: palette.gold,
              stroke: isDark ? '#0B1F3A' : '#FFFFFF',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const renderMonthlyTrendChart = (heightClass = 'h-[245px] sm:h-[260px]') =>
    monthlyCharts.monthlyTrend.length === 0 ? (
      <div className={`flex ${heightClass} items-center justify-center text-xs text-[#64748B] dark:text-[#94A3B8]`}>
        No timestamped churn events in current filter.
      </div>
    ) : (
      <div className={`${heightClass} w-full min-w-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={monthlyCharts.monthlyTrend}
            margin={{ top: 10, right: 16, left: -6, bottom: 2 }}
            onClick={(state: unknown) => {
              const label = (state as { activeLabel?: string } | null)?.activeLabel;
              if (typeof label === 'string' && label.length > 0) {
                toggleDimension('monthlyTrendMonth', label, modifierStateRef.current);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <XAxis
              dataKey="month"
              axisLine={{ stroke: palette.axisStroke }}
              tickLine={false}
              tick={{ fill: palette.tickFill, fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: palette.tickFill, fontSize: 11 }}
              tickFormatter={(v) => formatGBPCompact(Number(v))}
            />
            <Tooltip
              cursor={{ stroke: '#C89B3C', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={
                <ChartTooltip
                  hint="Click month on chart to inspect cancellations"
                  rowsBuilder={(_label, payload) => {
                    const raw = payload[0]?.payload as
                      | { lostMonthlyRevGBP?: number; churned?: number; sharePct?: number }
                      | undefined;
                    return [
                      {
                        label: 'Lost Monthly Rev',
                        value: formatGBP(Number(raw?.lostMonthlyRevGBP ?? 0)),
                        color: palette.crimson,
                      },
                      {
                        label: 'Churned Accounts',
                        value: formatNumber(Number(raw?.churned ?? 0)),
                        color: palette.gold,
                      },
                      {
                        label: 'Share of Trend Loss',
                        value: `${Number(raw?.sharePct ?? 0).toFixed(1)}%`,
                        color: palette.navy,
                      },
                    ];
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="lostMonthlyRevGBP"
              stroke={palette.crimson}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: palette.crimson, strokeWidth: 0 }}
              activeDot={{
                r: 6,
                fill: palette.gold,
                stroke: isDark ? '#0B1F3A' : '#FFFFFF',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );

  return (
    <div className="space-y-5 sm:space-y-6" onMouseDownCapture={captureModifiers}>
      {/* Welcoming Executive Header Strip */}
      <section className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 sm:p-6 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#0B1F3A] via-[#C89B3C] to-[#8B1E24] opacity-85" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="font-semibold text-[#B4821E] dark:text-[#E0B44C] uppercase tracking-wider text-[11px]">
                Portfolio Intelligence Brief
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC] truncate max-w-[260px]">
                {datasetMetadata?.datasetName ?? 'BritConnect UK Telecom Portfolio'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {formatNumber(customers.length)} accounts
                {datasetMetadata?.championRocAuc
                  ? ` · ROC-AUC ${datasetMetadata.championRocAuc.toFixed(3)}`
                  : ''}
              </span>
            </div>
            <p className="text-sm font-medium text-[#0B1F3A] dark:text-[#F8FAFC] leading-snug">
              {executiveInsight}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenCopilot && (
              <button
                type="button"
                onClick={onOpenCopilot}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 py-2 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#E0B44C] dark:text-[#040B16]" />
                <span>Run AI Brief</span>
              </button>
            )}
            {onTriggerUpload && (
              <button
                type="button"
                onClick={onTriggerUpload}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#C89B3C] dark:hover:border-[#E0B44C] active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <UploadCloud className="h-3.5 w-3.5 text-[#C89B3C] dark:text-[#E0B44C]" />
                <span>Upload Data</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Global Filter Toolbar */}
      <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Portfolio Scope Filters
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
              Showing {formatNumber(filtered.length)} of {formatNumber(customers.length)} UK subscribers · Click any chart bar, slice, curve, or KPI card to cross-filter
            </p>
          </div>
          {(hasActiveFilter || activeCustomerChips.length > 0) && (
            <button
              type="button"
              onClick={() => {
                onResetFilters();
                clearAllCrossFilters();
                notify('All portfolio scope and chart filters cleared.', 'info');
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 py-1.5 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#C89B3C] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {(
            [
              { key: 'ukNation', label: 'UK Nation', options: filterOptions.nations },
              { key: 'customerSegment', label: 'Segment', options: filterOptions.segments },
              { key: 'serviceType', label: 'Service Type', options: filterOptions.services },
              { key: 'contractType', label: 'Contract Type', options: filterOptions.contracts },
              { key: 'planName', label: 'Plan Name', options: filterOptions.plans },
              { key: 'riskTier', label: 'Risk Tier', options: filterOptions.tiers },
            ] as const
          ).map((f) => (
            <label key={f.key} className="block min-w-0">
              <span className="block text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] mb-1">
                {f.label}
              </span>
              <select
                value={filters[f.key]}
                onChange={(e) => onChangeFilters({ ...filters, [f.key]: e.target.value })}
                className="h-10 sm:h-9 w-full rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:border-[#C89B3C] dark:focus:border-[#E0B44C] focus:bg-white dark:focus:bg-[#132847] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] cursor-pointer transition-colors"
              >
                {f.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {hasActiveFilter && (
          <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#1E3A5F] flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Scope Filters:
            </span>
            {activeFilterEntries.map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChangeFilters({ ...filters, [key]: 'All' })}
                className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-[#C89B3C]/40 dark:border-[#E0B44C]/40 bg-[#FFFBEB]/60 dark:bg-[#132847] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] dark:text-[#E0B44C] hover:border-[#8B1E24] dark:hover:border-[#C93842] cursor-pointer transition-colors"
              >
                <span>
                  {FILTER_LABELS[key]}: {val}
                </span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Active Cross-Filter Chips Strip */}
      <ActiveCrossFilterBar
        chips={activeCustomerChips}
        multiSelectEnabled={multiSelectEnabled}
        onToggleMultiSelect={() => setMultiSelectEnabled(!multiSelectEnabled)}
        onClearAll={clearAllCrossFilters}
        matchingCount={filtered.length}
        totalCount={scopeFiltered.length}
      />

      {/* Top 6 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Total Customers */}
        <button
          type="button"
          disabled={activeCustomerChips.length === 0}
          onClick={activeCustomerChips.length > 0 ? clearAllCrossFilters : undefined}
          className={`group/kpi relative overflow-hidden text-left rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            activeCustomerChips.length > 0
              ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-[#C89B3C] dark:hover:border-[#E0B44C] active:scale-[0.99]'
              : 'cursor-default'
          }`}
        >
          {activeCustomerChips.length > 0 && (
            <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#0B1F3A] to-[#C89B3C]" />
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
              Total Customers
            </span>
            <div className="flex items-center gap-1.5">
              {activeCustomerChips.length > 0 && (
                <RotateCcw className="h-3 w-3 text-[#94A3B8] group-hover/kpi:text-[#C89B3C] transition-colors" />
              )}
              <Users className="h-4 w-4 text-[#94A3B8] dark:text-[#64748B]" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-2xl font-bold tracking-tight tabular-nums text-[#0B1F3A] dark:text-[#F8FAFC]">
            {formatNumber(kpis.totalCustomers)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            {formatNumber(kpis.activeCustomers)} active · LTV{' '}
            {formatCurrencyDisplay(kpis.totalLifetimeRevenueGBP, settings.compactCurrency)}
          </div>
        </button>

        {/* 2. Active Churn Rate (Clickable Cross-Filter) */}
        <button
          type="button"
          onClick={() => toggleChurnStatus('Churned')}
          className={`group/kpi relative overflow-hidden text-left rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            isChurnRateKpiActive
              ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
              : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C] dark:hover:border-[#E0B44C]'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#8B1E24] to-[#C89B3C] opacity-75" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
              Active Churn Rate
            </span>
            <div className="flex items-center gap-1.5">
              <Filter
                className={`h-3 w-3 transition-colors ${
                  isChurnRateKpiActive
                    ? 'text-[#C89B3C]'
                    : 'text-[#94A3B8] group-hover/kpi:text-[#C89B3C]'
                }`}
              />
              <TrendingDown className="h-4 w-4 text-[#94A3B8] dark:text-[#64748B]" />
            </div>
          </div>
          <div
            className={`mt-2.5 font-display text-2xl font-bold tracking-tight tabular-nums ${
              kpis.churnRatePct > 20
                ? 'text-[#8B1E24] dark:text-[#C93842]'
                : 'text-[#0B1F3A] dark:text-[#F8FAFC]'
            }`}
          >
            {formatPercent(kpis.churnRatePct)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            {isChurnRateKpiActive
              ? 'Filtered: Churned only (click to clear)'
              : `${formatNumber(kpis.churnedCustomers)} churned · Click to filter`}
          </div>
        </button>

        {/* 3. Monthly Revenue at Risk (Display Only — cursor-default) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
              Monthly Rev at Risk
            </span>
            <AlertTriangle className="h-4 w-4 text-[#94A3B8] dark:text-[#64748B]" />
          </div>
          <div className="mt-2.5 font-display text-2xl font-bold tracking-tight tabular-nums text-[#8B1E24] dark:text-[#C93842]">
            {formatCurrencyDisplay(kpis.predictedMonthlyRevenueAtRiskGBP, settings.compactCurrency)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            Reported: {formatCurrencyDisplay(kpis.monthlyRevenueAtRiskGBP, settings.compactCurrency)}
          </div>
        </div>

        {/* 4. High & Critical Risk (Clickable Cross-Filter + Explorer Jump) */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggleHighCriticalRisk}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleHighCriticalRisk();
            }
          }}
          className={`group/kpi relative overflow-hidden rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            isHighCritKpiActive
              ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
              : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C] dark:hover:border-[#E0B44C]'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#8B1E24] to-[#C89B3C]" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
              High & Critical Risk
            </span>
            <div className="flex items-center gap-1.5">
              <Filter
                className={`h-3 w-3 transition-colors ${
                  isHighCritKpiActive
                    ? 'text-[#C89B3C]'
                    : 'text-[#94A3B8] group-hover/kpi:text-[#C89B3C]'
                }`}
              />
              <ShieldAlert className="h-4 w-4 text-[#94A3B8] dark:text-[#64748B]" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-2xl font-bold tracking-tight tabular-nums text-[#8B1E24] dark:text-[#C93842]">
            {formatNumber(kpis.highCriticalRiskCount)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            <span className="truncate">
              {isHighCritKpiActive
                ? 'Active filter (click to clear)'
                : `${formatPercent(
                    kpis.totalCustomers > 0
                      ? (kpis.highCriticalRiskCount / kpis.totalCustomers) * 100
                      : 0
                  )} of view`}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToCustomers('High');
              }}
              className="inline-flex items-center gap-0.5 font-semibold text-[#B4821E] dark:text-[#E0B44C] hover:underline shrink-0 cursor-pointer"
            >
              <span>Inspect</span>
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover/kpi:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* 5. Expiring Contracts (Clickable Cross-Filter) */}
        <button
          type="button"
          onClick={toggleExpiringSoon}
          className={`group/kpi relative overflow-hidden text-left rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            isExpiringKpiActive
              ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
              : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C] dark:hover:border-[#E0B44C]'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#0B1F3A] to-[#C89B3C] opacity-75" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
              Expiring (&le;{settings.contractExpiryWindowDays}d)
            </span>
            <div className="flex items-center gap-1.5">
              <Filter
                className={`h-3 w-3 transition-colors ${
                  isExpiringKpiActive
                    ? 'text-[#C89B3C]'
                    : 'text-[#94A3B8] group-hover/kpi:text-[#C89B3C]'
                }`}
              />
              <Clock className="h-4 w-4 text-[#94A3B8] dark:text-[#64748B]" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-2xl font-bold tracking-tight tabular-nums text-[#0B1F3A] dark:text-[#F8FAFC]">
            {formatNumber(expiringCount)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            {isExpiringKpiActive ? 'Active filter (click to clear)' : 'Renewal window · Click to filter'}
          </div>
        </button>

        {/* 6. Avg CSAT & NPS (Display Only — cursor-default) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
              Avg CSAT & NPS
            </span>
            <HeartHandshake className="h-4 w-4 text-[#94A3B8] dark:text-[#64748B]" />
          </div>
          <div className="mt-2.5 font-display text-2xl font-bold tracking-tight tabular-nums text-[#B4821E] dark:text-[#E0B44C]">
            {kpis.avgSatisfaction.toFixed(1)} / 10
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            Mean NPS score: {kpis.avgNps >= 0 ? `+${kpis.avgNps}` : kpis.avgNps}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-10 sm:p-12 text-center shadow-sm">
          <p className="font-display text-base font-semibold text-[#0B1F3A] dark:text-[#F8FAFC]">
            No matching customer records
          </p>
          <p className="mt-1 text-sm text-[#475569] dark:text-[#94A3B8]">
            The combined cross-filters and portfolio scope returned zero subscribers.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {activeCustomerChips.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearAllCrossFilters();
                  notify('Cleared cross-filters.', 'info');
                }}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#C89B3C] dark:bg-[#E0B44C] px-4 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] cursor-pointer"
              >
                Clear Cross-Filters
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onResetFilters();
                clearAllCrossFilters();
                notify('Reset all filters.', 'info');
              }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#0B1F3A] dark:bg-[#132847] border border-[#1E3A5F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16325C] cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Row 1: Contract/Service Churn & UK Nation Revenue at Risk */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <ChartCard
              className="lg:col-span-7"
              title="Churn Rate & Subscriber Volume"
              subtitle={`Click any bar to cross-filter by ${
                breakdownMode === 'contract' ? 'Contract Type' : 'Service Type'
              }`}
              isFiltered={hasBreakdownFilter}
              onClearFilter={() => {
                clearDimension(activeBreakdownDim);
                notify(
                  `Cleared ${breakdownMode === 'contract' ? 'Contract' : 'Service'} filter.`,
                  'info'
                );
              }}
              exportData={contractOrServiceData as unknown as Array<Record<string, unknown>>}
              exportFilename={`churn_by_${breakdownMode}`}
              headerRight={
                <div className="inline-flex rounded-xl bg-[#F1F5F9] dark:bg-[#132847] p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('contract')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      breakdownMode === 'contract'
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    Contract
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('service')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      breakdownMode === 'service'
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    Service
                  </button>
                </div>
              }
              renderExpanded={() => renderBreakdownChart('h-full')}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <InteractiveLegend
                    items={[
                      { key: 'churnRatePct', label: 'Churn Rate (%)', color: palette.crimson },
                      { key: 'customers', label: 'Subscriber Volume', color: palette.navy },
                    ]}
                    hiddenKeys={hiddenBreakdownSeries}
                    onToggle={toggleBreakdownSeries}
                  />
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {contractOrServiceData.map((entry) => {
                      const selected = isDimensionSelected(activeBreakdownDim, entry.name);
                      return (
                        <button
                          key={entry.name}
                          type="button"
                          onClick={(e) => toggleDimension(activeBreakdownDim, entry.name, e)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            selected
                              ? 'bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16]'
                              : 'bg-[#F8FAFC] dark:bg-[#132847] text-[#475569] dark:text-[#94A3B8] hover:text-[#0B1F3A] dark:hover:text-white'
                          }`}
                        >
                          {entry.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              }
            >
              {renderBreakdownChart()}
            </ChartCard>

            {/* UK Nation & Top Cities Revenue at Risk */}
            <ChartCard
              className="lg:col-span-5 flex flex-col justify-between"
              title="UK Nation Monthly Revenue at Risk"
              subtitle="Click any UK nation bar or city to cross-filter portfolio exposure"
              isFiltered={hasNationFilter}
              onClearFilter={() => {
                clearDimension('ukNation');
                notify('Cleared UK Nation filter.', 'info');
              }}
              exportData={nationCharts.byNation as unknown as Array<Record<string, unknown>>}
              exportFilename="uk_nation_revenue_at_risk"
              renderExpanded={() => renderNationChart('h-full')}
              footer={
                <div className="border-t border-[#F1F5F9] dark:border-[#1E3A5F] pt-3">
                  <div className="text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-2">
                    Top Exposed UK Cities (Filtered View)
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {charts.topCities.map((c) => (
                      <button
                        key={c.city}
                        type="button"
                        onClick={(e) => toggleDimension('ukNation', c.nation, e)}
                        className="group/city flex items-center justify-between rounded-lg px-1.5 py-1 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#132847] hover:text-[#C89B3C] transition-colors min-w-0 cursor-pointer"
                      >
                        <span className="text-[#0F172A] dark:text-[#F8FAFC] group-hover/city:text-[#B4821E] dark:group-hover/city:text-[#E0B44C] truncate">
                          {c.city}
                        </span>
                        <span className="font-mono font-medium text-[#8B1E24] dark:text-[#C93842] tabular-nums shrink-0 ml-1">
                          {formatGBPCompact(c.revRiskGBP)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              }
            >
              {renderNationChart()}
            </ChartCard>
          </div>

          {/* Row 2: Risk Tier / Segment Donut + Probability Histogram + Top Churn Reasons */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Donut Chart with Risk Tier / Segment Toggle & Dynamic Center Readout */}
            <ChartCard
              className="lg:col-span-4"
              title={donutMode === 'tier' ? 'Risk Tier Composition' : 'Customer Segment Share'}
              subtitle="Hover slice to inspect · Click to cross-filter"
              isFiltered={hasDonutFilter}
              onClearFilter={() => {
                clearDimension(activeDonutDim);
                notify(`Cleared ${donutMode === 'tier' ? 'Risk Tier' : 'Segment'} filter.`, 'info');
              }}
              exportData={donutList as unknown as Array<Record<string, unknown>>}
              exportFilename={`donut_${donutMode}`}
              headerRight={
                <div className="inline-flex rounded-xl bg-[#F1F5F9] dark:bg-[#132847] p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDonutMode('tier')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                      donutMode === 'tier'
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8]'
                    }`}
                  >
                    Risk Tier
                  </button>
                  <button
                    type="button"
                    onClick={() => setDonutMode('segment')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                      donutMode === 'segment'
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8]'
                    }`}
                  >
                    Segment
                  </button>
                </div>
              }
              renderExpanded={() => (
                <div className="h-full flex flex-col sm:flex-row items-center justify-center gap-8">
                  <div className="relative h-[300px] w-[300px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutList}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={78}
                          outerRadius={122}
                          paddingAngle={2}
                          shape={renderExpandedPieSector}
                          onMouseEnter={(_d, idx) => setHoveredDonutIdx(idx)}
                          onMouseLeave={() => setHoveredDonutIdx(null)}
                          onClick={(entry: unknown) => {
                            const label = extractRechartsLabel(entry, 'name');
                            if (label) toggleDimension(activeDonutDim, label, modifierStateRef.current);
                          }}
                        >
                          {donutList.map((entry) => {
                            const selected = isDimensionSelected(activeDonutDim, entry.name);
                            const dimmed = hasDonutFilter && !selected;
                            return (
                              <Cell
                                key={entry.name}
                                fill={entry.color}
                                fillOpacity={dimmed ? 0.3 : 1}
                                stroke={selected ? palette.gold : undefined}
                                strokeWidth={selected ? 2.5 : 0}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip
                          content={
                            <ChartTooltip
                              hint="Click slice to cross-filter"
                              rowsBuilder={(_label, payload) => {
                                const raw = payload[0]?.payload as
                                  | { count?: number; sharePct?: number; revRiskGBP?: number }
                                  | undefined;
                                return [
                                  {
                                    label: 'Accounts',
                                    value: `${formatNumber(Number(raw?.count ?? 0))} (${Number(
                                      raw?.sharePct ?? 0
                                    ).toFixed(1)}%)`,
                                    color: palette.gold,
                                  },
                                  {
                                    label: 'Monthly Rev at Risk',
                                    value: formatGBP(Number(raw?.revRiskGBP ?? 0)),
                                    color: palette.crimson,
                                  },
                                ];
                              }}
                            />
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                      <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] truncate max-w-[130px]">
                        {hoveredDonutItem ? hoveredDonutItem.name : 'Total View'}
                      </span>
                      <span className="font-display text-2xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                        {formatNumber(hoveredDonutItem ? hoveredDonutItem.count : totalDonutCount)}
                      </span>
                      <span className="font-mono text-[11px] text-[#B4821E] dark:text-[#E0B44C] tabular-nums">
                        {hoveredDonutItem ? `${hoveredDonutItem.sharePct}% share` : '100% view'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            >
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative h-[184px] w-[184px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutList}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={76}
                        paddingAngle={2}
                        shape={renderExpandedPieSector}
                        onMouseEnter={(_d, idx) => setHoveredDonutIdx(idx)}
                        onMouseLeave={() => setHoveredDonutIdx(null)}
                        onClick={(entry: unknown) => {
                          const label = extractRechartsLabel(entry, 'name');
                          if (label) toggleDimension(activeDonutDim, label, modifierStateRef.current);
                        }}
                      >
                        {donutList.map((entry) => {
                          const selected = isDimensionSelected(activeDonutDim, entry.name);
                          const dimmed = hasDonutFilter && !selected;
                          return (
                            <Cell
                              key={entry.name}
                              fill={entry.color}
                              fillOpacity={dimmed ? 0.3 : 1}
                              stroke={selected ? palette.gold : undefined}
                              strokeWidth={selected ? 2.5 : 0}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        content={
                          <ChartTooltip
                            hint="Click slice to cross-filter"
                            rowsBuilder={(_label, payload) => {
                              const raw = payload[0]?.payload as
                                | { count?: number; sharePct?: number; revRiskGBP?: number }
                                | undefined;
                              return [
                                {
                                  label: 'Accounts',
                                  value: `${formatNumber(Number(raw?.count ?? 0))} (${Number(
                                    raw?.sharePct ?? 0
                                  ).toFixed(1)}%)`,
                                  color: palette.gold,
                                },
                                {
                                  label: 'Monthly Rev at Risk',
                                  value: formatGBP(Number(raw?.revRiskGBP ?? 0)),
                                  color: palette.crimson,
                                },
                              ];
                            }}
                          />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Dynamic Centered Donut Hole KPI Readout */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                    <span className="text-[10px] font-medium text-[#64748B] dark:text-[#94A3B8] truncate max-w-[88px]">
                      {hoveredDonutItem ? hoveredDonutItem.name : 'Total'}
                    </span>
                    <span className="font-display text-lg font-bold leading-tight text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                      {formatNumber(hoveredDonutItem ? hoveredDonutItem.count : totalDonutCount)}
                    </span>
                    <span className="font-mono text-[10px] text-[#B4821E] dark:text-[#E0B44C] tabular-nums">
                      {hoveredDonutItem ? `${hoveredDonutItem.sharePct}%` : '100%'}
                    </span>
                  </div>
                </div>

                <div className="w-full flex-1 space-y-1.5 text-xs min-w-0">
                  {donutList.map((item, idx) => {
                    const selected = isDimensionSelected(activeDonutDim, item.name);
                    const dimmed = hasDonutFilter && !selected;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onMouseEnter={() => setHoveredDonutIdx(idx)}
                        onMouseLeave={() => setHoveredDonutIdx(null)}
                        onClick={(e) => toggleDimension(activeDonutDim, item.name, e)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-all cursor-pointer ${
                          selected
                            ? 'ring-1 ring-[#C89B3C] dark:ring-[#E0B44C] bg-[#FFFBEB]/60 dark:bg-[#132847]'
                            : 'hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60'
                        } ${dimmed ? 'opacity-40' : 'opacity-100'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-[3px] shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC] truncate">
                            {item.name}
                          </span>
                        </div>
                        <span className="font-mono text-[#475569] dark:text-[#94A3B8] tabular-nums shrink-0 ml-2">
                          {formatNumber(item.count)} ({item.sharePct}%)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </ChartCard>

            {/* Churn Probability Histogram */}
            <ChartCard
              className="lg:col-span-4"
              title="Churn Probability Distribution"
              subtitle="Click any probability band to filter accounts"
              isFiltered={hasProbFilter}
              onClearFilter={() => {
                clearDimension('probBucket');
                notify('Cleared Probability Band filter.', 'info');
              }}
              exportData={probCharts.probabilityHistogram as unknown as Array<Record<string, unknown>>}
              exportFilename="churn_probability_distribution"
              renderExpanded={() => renderProbChart('h-full')}
            >
              {renderProbChart()}
            </ChartCard>

            {/* Top Churn Reasons Interactive Horizontal Ranked Bars */}
            <ChartCard
              className="lg:col-span-4"
              title="Top Churn Reasons"
              subtitle="Click a cancellation driver to cross-filter churned accounts"
              isFiltered={hasReasonFilter}
              onClearFilter={() => {
                clearDimension('churnReason');
                notify('Cleared Churn Reason filter.', 'info');
              }}
              exportData={reasonCharts.churnReasons as unknown as Array<Record<string, unknown>>}
              exportFilename="top_churn_reasons"
            >
              <div className="space-y-2">
                {reasonCharts.churnReasons.length === 0 ? (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-8 text-center">
                    No churned accounts in current filter.
                  </p>
                ) : (
                  reasonCharts.churnReasons.map((r) => {
                    const maxCount = Math.max(1, reasonCharts.churnReasons[0].count);
                    const widthPct = (r.count / maxCount) * 100;
                    const selected = isDimensionSelected('churnReason', r.reason);
                    const dimmed = hasReasonFilter && !selected;
                    return (
                      <button
                        key={r.reason}
                        type="button"
                        onClick={(e) => toggleDimension('churnReason', r.reason, e)}
                        className={`group/reason w-full rounded-xl px-2.5 py-2 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                          selected
                            ? 'ring-1 ring-[#C89B3C] dark:ring-[#E0B44C] bg-[#FFFBEB]/60 dark:bg-[#132847]'
                            : 'hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60'
                        } ${dimmed ? 'opacity-35' : 'opacity-100'}`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#0F172A] dark:text-[#F8FAFC] truncate pr-2">
                            <span className="truncate">{r.reason}</span>
                            <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 group-hover/reason:opacity-100 group-hover/reason:translate-x-0 text-[#C89B3C] transition-all" />
                          </span>
                          <span className="font-mono text-[#475569] dark:text-[#94A3B8] tabular-nums shrink-0">
                            {r.count} ({r.sharePct}%) · {formatGBPCompact(r.lostRevGBP)}/mo
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#F1F5F9] dark:bg-[#132847] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-200 group-hover/reason:brightness-110"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: selected ? palette.gold : palette.crimson,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ChartCard>
          </div>

          {/* Row 3: Tenure Cohort Churn Curve & Monthly Churn Revenue Loss Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <ChartCard
              className="lg:col-span-6"
              title="Tenure Cohort Churn Curve"
              subtitle="Click the curve or any cohort button below to cross-filter by tenure"
              isFiltered={hasTenureFilter}
              onClearFilter={() => {
                clearDimension('tenureCohort');
                notify('Cleared Tenure Cohort filter.', 'info');
              }}
              exportData={tenureCharts.tenureCurve as unknown as Array<Record<string, unknown>>}
              exportFilename="tenure_cohort_churn_curve"
              renderExpanded={() => renderTenureChart('h-full')}
              footer={
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  {tenureCharts.tenureCurve.map((tc) => {
                    const selected = isDimensionSelected('tenureCohort', tc.cohort);
                    const dimmed = hasTenureFilter && !selected;
                    return (
                      <button
                        key={tc.cohort}
                        type="button"
                        onClick={(e) => toggleDimension('tenureCohort', tc.cohort, e)}
                        className={`rounded-lg border px-2.5 py-1.5 sm:py-1 text-[11px] font-mono font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                          selected
                            ? 'border-[#C89B3C] dark:border-[#E0B44C] bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16]'
                            : 'border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] text-[#475569] dark:text-[#CBD5E1] hover:border-[#C89B3C]'
                        } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
                      >
                        {tc.cohort} ({tc.churnRatePct}%)
                      </button>
                    );
                  })}
                </div>
              }
            >
              {renderTenureChart()}
            </ChartCard>

            <ChartCard
              className="lg:col-span-6"
              title="Monthly Churn & Revenue Loss Trend"
              subtitle="Click any month on the trendline to isolate recorded cancellations"
              isFiltered={hasMonthlyTrendFilter}
              onClearFilter={() => {
                clearDimension('monthlyTrendMonth');
                notify('Cleared Churn Month filter.', 'info');
              }}
              exportData={monthlyCharts.monthlyTrend as unknown as Array<Record<string, unknown>>}
              exportFilename="monthly_churn_revenue_loss"
              renderExpanded={() => renderMonthlyTrendChart('h-full')}
              footer={
                monthlyCharts.monthlyTrend.length > 0 ? (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                    {monthlyCharts.monthlyTrend.map((mt) => {
                      const selected = isDimensionSelected('monthlyTrendMonth', mt.month);
                      const dimmed = hasMonthlyTrendFilter && !selected;
                      return (
                        <button
                          key={mt.month}
                          type="button"
                          onClick={(e) => toggleDimension('monthlyTrendMonth', mt.month, e)}
                          className={`rounded-lg border px-2.5 py-1.5 sm:py-1 text-[11px] font-mono font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            selected
                              ? 'border-[#C89B3C] dark:border-[#E0B44C] bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16]'
                              : 'border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] text-[#475569] dark:text-[#CBD5E1] hover:border-[#C89B3C]'
                          } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
                        >
                          {mt.month} ({mt.churned})
                        </button>
                      );
                    })}
                  </div>
                ) : undefined
              }
            >
              {renderMonthlyTrendChart()}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};
