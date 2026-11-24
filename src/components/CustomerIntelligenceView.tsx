import React, { useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Search,
  ArrowUpDown,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronNudge,
  Layers,
  Table2,
  LayoutGrid,
  ShieldAlert,
  Clock,
  PoundSterling,
  Users,
  Filter,
  RotateCcw,
} from 'lucide-react';
import type { PlatformSettings, ScoredCustomerRecord, StrategicSegment } from '../types/britconnect';
import {
  formatCurrencyDisplay,
  formatGBP,
  formatNumber,
  formatPercent,
  safeDivide,
} from '../utils/formatters';
import { isContractExpiringSoon } from '../utils/alerts';
import { getChartThemePalette } from '../utils/settings';
import { getValueRiskQuadrant, useCrossFilter } from '../context/CrossFilterContext';
import { useToast } from '../context/ToastContext';
import { ActiveCrossFilterBar } from './ActiveCrossFilterBar';
import {
  ChartCard,
  ChartTooltip,
  InteractiveLegend,
  renderExpandedPieSector,
} from './ChartUI';

interface CustomerIntelligenceViewProps {
  customers: ScoredCustomerRecord[];
  segments: StrategicSegment[];
  settings: PlatformSettings;
  isDark: boolean;
  initialRiskFilter?: string;
  onSelectCustomer: (customer: ScoredCustomerRecord) => void;
  onGenerateSegmentPlaybook: (segment: StrategicSegment) => void;
}

type SortField =
  | 'predictedProbability'
  | 'Monthly Charge GBP'
  | 'predictedMonthlyRevenueAtRisk'
  | 'Tenure Months';

type CustomerSubTab = 'combined' | 'segments' | 'explorer';

const QUADRANTS = [
  'High Value · High Risk',
  'High Value · Low Risk',
  'Standard · High Risk',
  'Standard · Low Risk',
] as const;

const RISK_TIERS = ['Critical', 'High', 'Medium', 'Low'] as const;

export const CustomerIntelligenceView: React.FC<CustomerIntelligenceViewProps> = ({
  customers,
  segments,
  settings,
  isDark,
  initialRiskFilter = 'All',
  onSelectCustomer,
  onGenerateSegmentPlaybook,
}) => {
  const [subTab, setSubTab] = useState<CustomerSubTab>(
    initialRiskFilter && initialRiskFilter !== 'All' ? 'explorer' : 'combined'
  );
  const [donutMode, setDonutMode] = useState<'payment' | 'autorenew'>('payment');
  const [search, setSearch] = useState('');
  const [selectedSegmentDropdown, setSelectedSegmentDropdown] = useState('All');
  const [selectedTierDropdown, setSelectedTierDropdown] = useState(initialRiskFilter);
  const [sortField, setSortField] = useState<SortField>('predictedProbability');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [hiddenScatterTiers, setHiddenScatterTiers] = useState<string[]>([]);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState<number | null>(null);
  const pageSize = 15;

  const palette = useMemo(() => getChartThemePalette(isDark), [isDark]);
  const { notify } = useToast();

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
    toggleExpiringSoon,
    toggleAutoRenew,
    clearDimension,
    clearAllCrossFilters,
    activeCustomerChips,
    filterCustomers,
    isDimensionSelected,
    hasDimensionFilter,
  } = useCrossFilter();

  React.useEffect(() => {
    if (initialRiskFilter && initialRiskFilter !== 'All') {
      setSelectedTierDropdown(initialRiskFilter);
      setSubTab('explorer');
      setPage(1);
    }
  }, [initialRiskFilter]);

  const crossFilteredCustomers = useMemo(
    () => filterCustomers(customers, null, settings),
    [customers, settings, filterCustomers]
  );

  // Self-chart preservation for Payment / Auto-Renew Donut
  const donutSourceRows = useMemo(
    () =>
      filterCustomers(customers, null, settings, [
        donutMode === 'payment' ? 'paymentMethod' : 'autoRenew',
      ]),
    [customers, settings, filterCustomers, donutMode]
  );

  // Self-chart preservation for 2D Value-vs-Risk Scatter Matrix
  const scatterSourceRows = useMemo(
    () => filterCustomers(customers, null, settings, ['valueRiskQuadrant']),
    [customers, settings, filterCustomers]
  );

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = crossFilteredCustomers.filter((c) => {
      if (selectedSegmentDropdown !== 'All' && c.strategicSegment !== selectedSegmentDropdown) return false;
      if (selectedTierDropdown !== 'All' && c.riskTier !== selectedTierDropdown) return false;
      if (q) {
        const match =
          c['Customer ID'].toLowerCase().includes(q) ||
          c.City.toLowerCase().includes(q) ||
          c['UK Nation'].toLowerCase().includes(q) ||
          c['Plan Name'].toLowerCase().includes(q) ||
          c.topRiskDriver.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      return sortAsc ? av - bv : bv - av;
    });
  }, [crossFilteredCustomers, search, selectedSegmentDropdown, selectedTierDropdown, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredSorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const summaryStats = useMemo(() => {
    const highCrit = crossFilteredCustomers.filter(
      (c) => c.riskTier === 'Critical' || c.riskTier === 'High'
    ).length;
    const revRisk = crossFilteredCustomers.reduce((s, c) => s + c.predictedMonthlyRevenueAtRisk, 0);
    const expiring = crossFilteredCustomers.filter((c) => isContractExpiringSoon(c, settings)).length;
    return { highCrit, revRisk, expiring };
  }, [crossFilteredCustomers, settings]);

  const scatterData = useMemo(() => {
    const visibleRows = scatterSourceRows.filter((c) => !hiddenScatterTiers.includes(c.riskTier));
    const step = Math.max(1, Math.floor(visibleRows.length / 260));
    return visibleRows
      .filter((_, i) => i % step === 0)
      .map((c) => ({
        id: c['Customer ID'],
        charge: c['Monthly Charge GBP'],
        riskPct: Number((c.predictedProbability * 100).toFixed(1)),
        tier: c.riskTier,
        segment: c.strategicSegment,
        quadrant: getValueRiskQuadrant(c, settings),
        raw: c,
      }));
  }, [scatterSourceRows, settings, hiddenScatterTiers]);

  const donutData = useMemo(() => {
    const map = new Map<string, { count: number; revRisk: number }>();
    for (const r of donutSourceRows) {
      const key =
        donutMode === 'payment'
          ? r['Payment Method']
          : r['Auto Renew'] === 'Yes'
          ? 'Auto-Renew On'
          : 'Auto-Renew Off';
      const cur = map.get(key) ?? { count: 0, revRisk: 0 };
      cur.count++;
      cur.revRisk += r.predictedMonthlyRevenueAtRisk;
      map.set(key, cur);
    }
    const colors = [palette.navy, palette.gold, palette.crimson, palette.slateNavy];
    const total = Math.max(1, donutSourceRows.length);
    return Array.from(map.entries())
      .map(([name, v], idx) => ({
        name,
        count: v.count,
        sharePct: Number((safeDivide(v.count, total) * 100).toFixed(1)),
        revRiskGBP: Math.round(v.revRisk),
        color: colors[idx % colors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [donutSourceRows, donutMode, palette]);

  const hoveredDonutItem =
    hoveredDonutIdx !== null && donutData[hoveredDonutIdx] ? donutData[hoveredDonutIdx] : null;

  const tierColors: Record<string, string> = {
    Critical: palette.crimson,
    High: palette.crimsonSoft,
    Medium: palette.gold,
    Low: palette.slateNavy,
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setPage(1);
  };

  const rowPad = settings.tableDensity === 'compact' ? 'py-1.5' : 'py-2.5';
  const hasSegFilter = hasDimensionFilter('strategicSegment');
  const hasQuadrantFilter = hasDimensionFilter('valueRiskQuadrant');
  const hasDonutFilter =
    donutMode === 'payment' ? hasDimensionFilter('paymentMethod') : crossFilters.autoRenew !== 'All';

  const isHighCritActive =
    crossFilters.riskTier.length === 2 &&
    crossFilters.riskTier.includes('Critical') &&
    crossFilters.riskTier.includes('High');

  const isDonutSliceSelected = (name: string) => {
    if (donutMode === 'payment') return isDimensionSelected('paymentMethod', name);
    return (
      (name === 'Auto-Renew On' && crossFilters.autoRenew === 'Yes') ||
      (name === 'Auto-Renew Off' && crossFilters.autoRenew === 'No')
    );
  };

  const handleDonutToggle = (name: string) => {
    if (donutMode === 'payment') {
      toggleDimension('paymentMethod', name, modifierStateRef.current);
    } else {
      toggleAutoRenew(name === 'Auto-Renew On' ? 'Yes' : 'No');
    }
    setPage(1);
  };

  const extractName = (item: unknown): string | null => {
    if (!item || typeof item !== 'object') return null;
    const rec = item as Record<string, unknown>;
    if (typeof rec.name === 'string') return rec.name;
    if (rec.payload && typeof rec.payload === 'object') {
      const p = rec.payload as Record<string, unknown>;
      if (typeof p.name === 'string') return p.name;
    }
    return null;
  };

  const toggleScatterTier = (tier: string) => {
    setHiddenScatterTiers((prev) => {
      if (prev.includes(tier)) return prev.filter((t) => t !== tier);
      if (prev.length >= RISK_TIERS.length - 1) return prev;
      return [...prev, tier];
    });
  };

  const clearAllLocalAndCross = () => {
    setSearch('');
    setSelectedSegmentDropdown('All');
    setSelectedTierDropdown('All');
    clearAllCrossFilters();
    setPage(1);
    notify('Cleared customer explorer and cross-filters.', 'info');
  };

  const renderScatterChart = (heightClass = 'h-[245px] sm:h-[265px]') => (
    <div className={`${heightClass} w-full min-w-0`}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 14, left: -12, bottom: 6 }}>
          <XAxis
            type="number"
            dataKey="charge"
            name="Monthly Charge"
            axisLine={{ stroke: palette.axisStroke }}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
            tickFormatter={(v) => `£${v}`}
          />
          <YAxis
            type="number"
            dataKey="riskPct"
            name="Churn Risk"
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: palette.tickFill, fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ strokeDasharray: '4 4', stroke: '#C89B3C', strokeWidth: 1 }}
            content={
              <ChartTooltip
                hint="Click dot to inspect full Customer 360° profile"
                titleOverride={(_label, payload) => {
                  const raw = payload[0]?.payload as { id?: string; tier?: string } | undefined;
                  return raw?.id ? `${raw.id} · ${raw.tier ?? ''} Risk` : 'Subscriber Point';
                }}
                rowsBuilder={(_label, payload) => {
                  const raw = payload[0]?.payload as
                    | {
                        segment?: string;
                        charge?: number;
                        riskPct?: number;
                        quadrant?: string;
                      }
                    | undefined;
                  return [
                    { label: 'Segment', value: raw?.segment ?? '—', color: palette.navy },
                    {
                      label: 'Monthly Charge',
                      value: formatGBP(Number(raw?.charge ?? 0), 2),
                      color: palette.gold,
                    },
                    {
                      label: 'Churn Risk',
                      value: `${Number(raw?.riskPct ?? 0).toFixed(1)}%`,
                      color: palette.crimson,
                    },
                    { label: 'Cluster', value: raw?.quadrant ?? '—' },
                  ];
                }}
              />
            }
          />
          <Scatter
            data={scatterData}
            onClick={(pt: unknown) => {
              const item = pt as {
                payload?: { raw?: ScoredCustomerRecord };
                raw?: ScoredCustomerRecord;
              };
              const rec = item?.payload?.raw ?? item?.raw;
              if (rec) onSelectCustomer(rec);
            }}
            style={{ cursor: 'pointer' }}
          >
            {scatterData.map((entry) => {
              const inQuadrant = isDimensionSelected('valueRiskQuadrant', entry.quadrant);
              const dimmed = hasQuadrantFilter && !inQuadrant;
              return (
                <Cell
                  key={entry.id}
                  fill={tierColors[entry.tier]}
                  fillOpacity={dimmed ? 0.16 : 0.85}
                  stroke={inQuadrant ? palette.gold : undefined}
                  strokeWidth={inQuadrant ? 1.5 : 0}
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );

  const showSegmentsSection = subTab === 'combined' || subTab === 'segments';
  const showExplorerSection = subTab === 'combined' || subTab === 'explorer';

  return (
    <div className="space-y-5 sm:space-y-6" onMouseDownCapture={captureModifiers}>
      {/* Horizontal Touch-Scrollable Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] pb-3">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <div className="inline-flex rounded-xl bg-[#E2E8F0]/60 dark:bg-[#132847] p-1 gap-1">
            {(
              [
                { id: 'combined', label: 'Combined Workspace', icon: LayoutGrid },
                { id: 'segments', label: 'Segments & Matrix', icon: Layers },
                {
                  id: 'explorer',
                  label: `Risk Explorer (${formatNumber(filteredSorted.length)})`,
                  icon: Table2,
                },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                    subTab === t.id
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
          Critical &ge;{settings.criticalThresholdPct}% · High &ge;{settings.highThresholdPct}% · Medium &ge;
          {settings.mediumThresholdPct}%
        </div>
      </div>

      {/* Active Cross-Filter Strip */}
      <ActiveCrossFilterBar
        chips={activeCustomerChips}
        multiSelectEnabled={multiSelectEnabled}
        onToggleMultiSelect={() => setMultiSelectEnabled(!multiSelectEnabled)}
        onClearAll={clearAllCrossFilters}
        matchingCount={crossFilteredCustomers.length}
        totalCount={customers.length}
      />

      {/* Interactive 4-Card KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          disabled={activeCustomerChips.length === 0}
          onClick={activeCustomerChips.length > 0 ? clearAllCrossFilters : undefined}
          className={`group/kpi relative overflow-hidden text-left rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            activeCustomerChips.length > 0
              ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-[#C89B3C] active:scale-[0.99]'
              : 'cursor-default'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#94A3B8]">
            <span>Filtered Accounts</span>
            <Users className="h-4 w-4 text-[#94A3B8]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
            {formatNumber(crossFilteredCustomers.length)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            of {formatNumber(customers.length)} total subscribers
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            toggleHighCriticalRisk();
            setPage(1);
          }}
          className={`group/kpi relative overflow-hidden text-left rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            isHighCritActive
              ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
              : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C]'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#8B1E24] to-[#C89B3C]" />
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#94A3B8]">
            <span>High & Critical Risk</span>
            <div className="flex items-center gap-1.5">
              <Filter
                className={`h-3 w-3 transition-colors ${
                  isHighCritActive ? 'text-[#C89B3C]' : 'text-[#94A3B8] group-hover/kpi:text-[#C89B3C]'
                }`}
              />
              <ShieldAlert className="h-4 w-4 text-[#94A3B8]" />
            </div>
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#8B1E24] dark:text-[#C93842] tabular-nums">
            {formatNumber(summaryStats.highCrit)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            {isHighCritActive ? 'Active cross-filter (tap to clear)' : 'Tap to filter High + Critical'}
          </div>
        </button>

        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm cursor-default">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#94A3B8]">
            <span>Monthly Rev Exposure</span>
            <PoundSterling className="h-4 w-4 text-[#94A3B8]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0B1F3A] dark:text-[#E0B44C] tabular-nums">
            {formatCurrencyDisplay(summaryStats.revRisk, settings.compactCurrency)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Model-weighted monthly GBP at risk
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            toggleExpiringSoon();
            setPage(1);
          }}
          className={`group/kpi relative overflow-hidden text-left rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            crossFilters.expiringSoon
              ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
              : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C]'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#0B1F3A] to-[#C89B3C] opacity-75" />
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#94A3B8]">
            <span>Expiring (&le;{settings.contractExpiryWindowDays}d)</span>
            <div className="flex items-center gap-1.5">
              <Filter
                className={`h-3 w-3 transition-colors ${
                  crossFilters.expiringSoon
                    ? 'text-[#C89B3C]'
                    : 'text-[#94A3B8] group-hover/kpi:text-[#C89B3C]'
                }`}
              />
              <Clock className="h-4 w-4 text-[#94A3B8]" />
            </div>
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
            {formatNumber(summaryStats.expiring)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            {crossFilters.expiringSoon ? 'Active cross-filter (tap to clear)' : 'Tap to filter renewal window'}
          </div>
        </button>
      </section>

      {/* SECTION 1: STRATEGIC SEGMENTS + 2D VALUE-VS-RISK MATRIX + PAYMENT/AUTO-RENEW DONUT */}
      {showSegmentsSection && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
          {/* Interactive Segment Cards */}
          <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
            {segments.map((seg) => {
              const isSelected = isDimensionSelected('strategicSegment', seg.name);
              const isDimmed = hasSegFilter && !isSelected;
              return (
                <div
                  key={seg.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    toggleDimension('strategicSegment', seg.name, e);
                    setPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleDimension('strategicSegment', seg.name, false);
                      setPage(1);
                    }
                  }}
                  className={`group/seg cursor-pointer rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                    isSelected
                      ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
                      : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C] dark:hover:border-[#E0B44C]'
                  } ${isDimmed ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC] group-hover/seg:text-[#B4821E] dark:group-hover/seg:text-[#E0B44C] transition-colors">
                        {seg.name}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-[#0B1F3A] dark:text-[#E0B44C] tabular-nums shrink-0">
                        {formatNumber(seg.customerCount)} ({seg.sharePct}%)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                      {seg.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#1E3A5F] space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Avg Risk</div>
                        <div
                          className={`font-mono font-semibold tabular-nums ${
                            seg.avgChurnRiskPct >= 50
                              ? 'text-[#8B1E24] dark:text-[#C93842]'
                              : 'text-[#0B1F3A] dark:text-[#F8FAFC]'
                          }`}
                        >
                          {formatPercent(seg.avgChurnRiskPct)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Rev at Risk</div>
                        <div className="font-mono font-semibold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                          {formatCurrencyDisplay(seg.monthlyRevenueAtRiskGBP, settings.compactCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Avg Tenure</div>
                        <div className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                          {seg.avgTenureMonths}m
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                        Driver:{' '}
                        <span className="text-[#0F172A] dark:text-[#F8FAFC] font-medium">
                          {seg.dominantDriver}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSegmentPlaybook(seg);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B4821E] dark:text-[#E0B44C] hover:text-[#0B1F3A] dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" /> Playbook
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2D Value-vs-Risk Scatter Matrix + Payment/Auto-Renew Donut */}
          <div className="xl:col-span-7 grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
            <ChartCard
              className="lg:col-span-7 flex flex-col justify-between"
              title="Value-vs-Risk Cluster Matrix"
              subtitle="Click any dot for 360° profile · Toggle risk tiers or filter by quadrant"
              isFiltered={hasQuadrantFilter}
              onClearFilter={() => {
                clearDimension('valueRiskQuadrant');
                notify('Cleared cluster quadrant filter.', 'info');
              }}
              exportData={
                scatterData.map((s) => ({
                  customerId: s.id,
                  segment: s.segment,
                  riskTier: s.tier,
                  monthlyChargeGBP: s.charge,
                  churnRiskPct: s.riskPct,
                  quadrant: s.quadrant,
                })) as Array<Record<string, unknown>>
              }
              exportFilename="value_vs_risk_clusters"
              renderExpanded={() => renderScatterChart('h-full')}
              footer={
                <div className="space-y-2.5 pt-1">
                  <InteractiveLegend
                    items={RISK_TIERS.map((tier) => ({
                      key: tier,
                      label: tier,
                      color: tierColors[tier],
                    }))}
                    hiddenKeys={hiddenScatterTiers}
                    onToggle={toggleScatterTier}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUADRANTS.map((q) => {
                      const selected = isDimensionSelected('valueRiskQuadrant', q);
                      const dimmed = hasQuadrantFilter && !selected;
                      return (
                        <button
                          key={q}
                          type="button"
                          onClick={(e) => {
                            toggleDimension('valueRiskQuadrant', q, e);
                            setPage(1);
                          }}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                            selected
                              ? 'border-[#C89B3C] dark:border-[#E0B44C] bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16]'
                              : 'border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] text-[#475569] dark:text-[#CBD5E1] hover:border-[#C89B3C]'
                          } ${dimmed ? 'opacity-45' : 'opacity-100'}`}
                        >
                          {q}
                        </button>
                      );
                    })}
                  </div>
                </div>
              }
            >
              {renderScatterChart()}
            </ChartCard>

            {/* Payment Method / Auto-Renew Split Donut */}
            <ChartCard
              className="lg:col-span-5 flex flex-col justify-between"
              title={donutMode === 'payment' ? 'Payment Method Mix' : 'Auto-Renew Status'}
              subtitle="Hover slice to inspect · Click to cross-filter"
              isFiltered={hasDonutFilter}
              onClearFilter={() => {
                clearDimension(donutMode === 'payment' ? 'paymentMethod' : 'autoRenew');
                notify('Cleared billing split filter.', 'info');
              }}
              exportData={donutData as unknown as Array<Record<string, unknown>>}
              exportFilename={`billing_split_${donutMode}`}
              headerRight={
                <div className="inline-flex rounded-xl bg-[#F1F5F9] dark:bg-[#132847] p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDonutMode('payment')}
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium cursor-pointer ${
                      donutMode === 'payment'
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8]'
                    }`}
                  >
                    Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setDonutMode('autorenew')}
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium cursor-pointer ${
                      donutMode === 'autorenew'
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8]'
                    }`}
                  >
                    Auto-Renew
                  </button>
                </div>
              }
              footer={
                <div className="space-y-1.5 text-xs">
                  {donutData.map((item, idx) => {
                    const selected = isDonutSliceSelected(item.name);
                    const dimmed = hasDonutFilter && !selected;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onMouseEnter={() => setHoveredDonutIdx(idx)}
                        onMouseLeave={() => setHoveredDonutIdx(null)}
                        onClick={() => handleDonutToggle(item.name)}
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
                          {item.sharePct}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              }
            >
              <div className="relative h-[188px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={76}
                      paddingAngle={2}
                      shape={renderExpandedPieSector}
                      onMouseEnter={(_d, idx) => setHoveredDonutIdx(idx)}
                      onMouseLeave={() => setHoveredDonutIdx(null)}
                      onClick={(entry: unknown) => {
                        const name = extractName(entry);
                        if (name) handleDonutToggle(name);
                      }}
                    >
                      {donutData.map((entry) => {
                        const selected = isDonutSliceSelected(entry.name);
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
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <span className="text-[10px] font-medium text-[#64748B] dark:text-[#94A3B8] truncate max-w-[92px]">
                    {hoveredDonutItem ? hoveredDonutItem.name : 'Accounts'}
                  </span>
                  <span className="font-display text-lg font-bold leading-tight text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                    {formatNumber(hoveredDonutItem ? hoveredDonutItem.count : donutSourceRows.length)}
                  </span>
                  <span className="font-mono text-[10px] text-[#B4821E] dark:text-[#E0B44C] tabular-nums">
                    {hoveredDonutItem ? `${hoveredDonutItem.sharePct}%` : '100%'}
                  </span>
                </div>
              </div>
            </ChartCard>
          </div>
        </section>
      )}

      {/* SECTION 2: LIVE CROSS-FILTERED CUSTOMER RISK EXPLORER */}
      {showExplorerSection && (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-6 py-4">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                Customer Risk Explorer
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
                Showing {formatNumber(pageRows.length)} of {formatNumber(filteredSorted.length)} matching accounts
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search ID, city, plan, driver..."
                  className="h-10 sm:h-9 w-full sm:w-56 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] pl-8 pr-3 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:border-[#C89B3C] dark:focus:border-[#E0B44C] focus:bg-white dark:focus:bg-[#132847] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
                />
              </div>

              <select
                value={selectedSegmentDropdown}
                onChange={(e) => {
                  setSelectedSegmentDropdown(e.target.value);
                  setPage(1);
                }}
                className="h-10 sm:h-9 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
              >
                <option value="All">All Strategic Segments</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedTierDropdown}
                onChange={(e) => {
                  setSelectedTierDropdown(e.target.value);
                  setPage(1);
                }}
                className="h-10 sm:h-9 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
              >
                <option value="All">All Risk Tiers</option>
                <option value="Critical">Critical (&ge;{settings.criticalThresholdPct}%)</option>
                <option value="High">
                  High ({settings.highThresholdPct}–{settings.criticalThresholdPct - 1}%)
                </option>
                <option value="Medium">
                  Medium ({settings.mediumThresholdPct}–{settings.highThresholdPct - 1}%)
                </option>
                <option value="Low">Low (&lt;{settings.mediumThresholdPct}%)</option>
              </select>
            </div>
          </div>

          {/* Mobile Tappable Card View (< 640px) */}
          <div className="sm:hidden divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
            {pageRows.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  No customers match the active cross-filters and search criteria.
                </p>
                <button
                  type="button"
                  onClick={clearAllLocalAndCross}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#C89B3C] px-4 text-xs font-semibold text-[#0B1F3A] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear Active Filters
                </button>
              </div>
            ) : (
              pageRows.map((c) => (
                <button
                  key={c['Customer ID']}
                  type="button"
                  onClick={() => onSelectCustomer(c)}
                  className="w-full min-h-[44px] p-4 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60 active:opacity-90 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#0B1F3A] dark:text-[#E0B44C]">
                      {c['Customer ID']}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        c.riskTier === 'Critical' || c.riskTier === 'High'
                          ? 'text-[#8B1E24] dark:text-[#C93842]'
                          : c.riskTier === 'Medium'
                          ? 'text-[#B4821E] dark:text-[#E0B44C]'
                          : 'text-[#16325C] dark:text-[#4B7BEC]'
                      }`}
                    >
                      {formatPercent(c.predictedProbability * 100)} · {c.riskTier}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#334155] dark:text-[#CBD5E1]">
                    <span className="truncate pr-2">
                      {c.City}, {c['UK Nation']} · {c['Plan Name']}
                    </span>
                    <span className="font-mono font-semibold tabular-nums shrink-0">
                      {formatGBP(c['Monthly Charge GBP'], 2)}/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    <span className="truncate pr-2">Driver: {c.topRiskDriver}</span>
                    <span className="inline-flex items-center gap-0.5 font-semibold text-[#B4821E] dark:text-[#E0B44C] shrink-0">
                      360° <ChevronNudge className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Desktop & Tablet Sortable Table (sm+) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#F8FAFC] dark:bg-[#132847] px-4 py-3 font-semibold whitespace-nowrap">
                    Customer ID
                  </th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">UK Location & Plan</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Strategic Segment</th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('Tenure Months')}
                      className="inline-flex items-center gap-1 hover:text-[#0B1F3A] dark:hover:text-white cursor-pointer"
                    >
                      Tenure <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('Monthly Charge GBP')}
                      className="inline-flex items-center gap-1 hover:text-[#0B1F3A] dark:hover:text-white cursor-pointer"
                    >
                      Monthly Charge <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('predictedProbability')}
                      className="inline-flex items-center gap-1 hover:text-[#0B1F3A] dark:hover:text-white cursor-pointer"
                    >
                      Churn Risk <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('predictedMonthlyRevenueAtRisk')}
                      className="inline-flex items-center gap-1 hover:text-[#0B1F3A] dark:hover:text-white cursor-pointer"
                    >
                      Rev at Risk <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Top Risk Driver</th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                        No customers match the active cross-filters and search criteria.
                      </p>
                      <button
                        type="button"
                        onClick={clearAllLocalAndCross}
                        className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#C89B3C] px-4 py-1.5 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear Active Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((c) => (
                    <tr
                      key={c['Customer ID']}
                      onClick={() => onSelectCustomer(c)}
                      className="group cursor-pointer hover:bg-[#FFFBEB]/45 dark:hover:bg-[#132847]/75 transition-colors"
                    >
                      <td
                        className={`sticky left-0 z-10 bg-white dark:bg-[#0D1E36] group-hover:bg-[#FFFDF5] dark:group-hover:bg-[#132847] px-4 ${rowPad} font-mono font-semibold text-[#0B1F3A] dark:text-[#E0B44C] whitespace-nowrap`}
                      >
                        {c['Customer ID']}
                      </td>
                      <td className={`px-4 ${rowPad} whitespace-nowrap`}>
                        <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                          {c.City}, {c['UK Nation']}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {c['Plan Name']} · {c['Contract Type']}
                        </div>
                      </td>
                      <td className={`px-4 ${rowPad} text-[#334155] dark:text-[#CBD5E1] whitespace-nowrap`}>
                        {c.strategicSegment}
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}
                      >
                        {c['Tenure Months']}m
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}
                      >
                        {formatGBP(c['Monthly Charge GBP'], 2)}
                      </td>
                      <td className={`px-4 ${rowPad} text-right whitespace-nowrap`}>
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            c.riskTier === 'Critical' || c.riskTier === 'High'
                              ? 'text-[#8B1E24] dark:text-[#C93842]'
                              : c.riskTier === 'Medium'
                              ? 'text-[#B4821E] dark:text-[#E0B44C]'
                              : 'text-[#16325C] dark:text-[#4B7BEC]'
                          }`}
                        >
                          {formatPercent(c.predictedProbability * 100)}
                        </span>
                        <span className="ml-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          · {c.riskTier}
                        </span>
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC] tabular-nums`}
                      >
                        {formatGBP(c.predictedMonthlyRevenueAtRisk, 2)}
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-[#334155] dark:text-[#CBD5E1] max-w-[190px] truncate`}
                      >
                        {c.topRiskDriver}
                      </td>
                      <td className={`px-4 ${rowPad} text-right whitespace-nowrap`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCustomer(c);
                          }}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2.5 py-1 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] group-hover:border-[#C89B3C] dark:group-hover:border-[#E0B44C] transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>360°</span>
                          <ChevronNudge className="h-3 w-3 text-[#94A3B8] group-hover:translate-x-0.5 group-hover:text-[#C89B3C] transition-all" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-6 py-3 bg-[#F8FAFC] dark:bg-[#132847] text-xs text-[#475569] dark:text-[#94A3B8]">
            <span className="tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-9 sm:h-8 items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#C89B3C] disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-9 sm:h-8 items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#C89B3C] disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
