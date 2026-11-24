import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  PlayCircle,
  CalendarClock,
  PoundSterling,
  Filter,
  RotateCcw,
} from 'lucide-react';
import type { PlatformSettings, RetentionCampaign, StrategicSegment } from '../types/britconnect';
import {
  formatCurrencyDisplay,
  formatDateUK,
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

interface CampaignsViewProps {
  campaigns: RetentionCampaign[];
  segments: StrategicSegment[];
  settings: PlatformSettings;
  isDark: boolean;
  onSaveCampaign: (campaign: RetentionCampaign) => void;
  onDeleteCampaign: (id: string) => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  segments,
  settings,
  isDark,
  onSaveCampaign,
  onDeleteCampaign,
}) => {
  const [editing, setEditing] = useState<RetentionCampaign | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState<number | null>(null);
  const [hiddenBarSeries, setHiddenBarSeries] = useState<string[]>([]);
  const palette = useMemo(() => getChartThemePalette(isDark), [isDark]);
  const { notify } = useToast();

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

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
    clearDimension,
    clearCampaignCrossFilters,
    activeCampaignChips,
    isDimensionSelected,
    hasDimensionFilter,
  } = useCrossFilter();

  // Campaigns matching all active campaign cross-filters
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (crossFilters.campaignStatus.length > 0 && !crossFilters.campaignStatus.includes(c.status)) {
        return false;
      }
      if (crossFilters.campaignChannel.length > 0 && !crossFilters.campaignChannel.includes(c.channel)) {
        return false;
      }
      return true;
    });
  }, [campaigns, crossFilters.campaignChannel, crossFilters.campaignStatus]);

  // Self-chart preservation for Channel ROI Donut
  const channelDonutSource = useMemo(() => {
    return campaigns.filter((c) => {
      if (crossFilters.campaignStatus.length > 0 && !crossFilters.campaignStatus.includes(c.status)) {
        return false;
      }
      return true;
    });
  }, [campaigns, crossFilters.campaignStatus]);

  const statusCounts = useMemo(() => {
    const channelFiltered = campaigns.filter(
      (c) => crossFilters.campaignChannel.length === 0 || crossFilters.campaignChannel.includes(c.channel)
    );
    return {
      Active: channelFiltered.filter((c) => c.status === 'Active').length,
      Completed: channelFiltered.filter((c) => c.status === 'Completed').length,
      Planned: channelFiltered.filter((c) => c.status === 'Planned').length,
    };
  }, [campaigns, crossFilters.campaignChannel]);

  const totals = useMemo(() => {
    const cost = filteredCampaigns.reduce((s, c) => s + c.campaignCostGBP, 0);
    const saved = filteredCampaigns.reduce((s, c) => s + c.revenueSavedGBP, 0);
    const retained = filteredCampaigns.reduce((s, c) => s + c.retained, 0);
    const contacted = filteredCampaigns.reduce((s, c) => s + c.contacted, 0);
    const avgLift =
      filteredCampaigns.length > 0
        ? filteredCampaigns.reduce((s, c) => s + (c.controlChurnPct - c.treatmentChurnPct), 0) /
          filteredCampaigns.length
        : 0;
    const netRoi = safeDivide(saved - cost, cost) * 100;
    return { cost, saved, retained, contacted, avgLift, netRoi };
  }, [filteredCampaigns]);

  const groupedChartData = useMemo(
    () =>
      filteredCampaigns.map((c) => ({
        name: c.name.length > 20 ? `${c.name.slice(0, 20)}…` : c.name,
        fullName: c.name,
        channel: c.channel,
        roiPct: Number((safeDivide(c.revenueSavedGBP - c.campaignCostGBP, c.campaignCostGBP) * 100).toFixed(1)),
        revenueSavedGBP: c.revenueSavedGBP,
        campaignCostGBP: c.campaignCostGBP,
      })),
    [filteredCampaigns]
  );

  const channelDonutData = useMemo(() => {
    const map = new Map<string, { saved: number; cost: number; count: number }>();
    for (const c of channelDonutSource) {
      const cur = map.get(c.channel) ?? { saved: 0, cost: 0, count: 0 };
      cur.saved += c.revenueSavedGBP;
      cur.cost += c.campaignCostGBP;
      cur.count += 1;
      map.set(c.channel, cur);
    }
    const totalSaved = Math.max(
      1,
      Array.from(map.values()).reduce((s, v) => s + Math.max(v.saved, v.cost), 0)
    );
    const colors = [palette.navy, palette.gold, palette.crimson, palette.slateNavy, palette.crimsonSoft];
    return Array.from(map.entries())
      .map(([name, v], idx) => {
        const valueMetric = v.saved > 0 ? v.saved : v.cost;
        return {
          name,
          valueMetric,
          savedGBP: v.saved,
          costGBP: v.cost,
          roiPct: Number((safeDivide(v.saved - v.cost, v.cost) * 100).toFixed(0)),
          sharePct: Number((safeDivide(valueMetric, totalSaved) * 100).toFixed(1)),
          count: v.count,
          color: colors[idx % colors.length],
        };
      })
      .sort((a, b) => b.valueMetric - a.valueMetric);
  }, [channelDonutSource, palette]);

  const hoveredDonutItem =
    hoveredDonutIdx !== null && channelDonutData[hoveredDonutIdx]
      ? channelDonutData[hoveredDonutIdx]
      : null;

  const openNewModal = () => {
    setEditing({
      id: `camp-${Date.now()}`,
      name: '',
      targetSegment: segments[0]?.name ?? 'High-Value Flight Risks',
      channel: 'Outbound Call',
      offerType: `${Math.min(settings.maxDiscountCapPct, 15)}% Loyalty Lock-In Discount`,
      status: 'Planned',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      targetCustomers: 50,
      contacted: 0,
      retained: 0,
      campaignCostGBP: 50 * settings.defaultOfferCostGBP,
      revenueSavedGBP: 0,
      treatmentChurnPct: 12.0,
      controlChurnPct: 28.0,
      createdAt: new Date().toISOString(),
    });
    setModalOpen(true);
  };

  const openEditModal = (c: RetentionCampaign) => {
    setEditing({ ...c });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    onSaveCampaign(editing);
    setModalOpen(false);
    setEditing(null);
  };

  const extractChannelFromEntry = (item: unknown): string | null => {
    if (!item || typeof item !== 'object') return null;
    const rec = item as Record<string, unknown>;
    if (typeof rec.channel === 'string') return rec.channel;
    if (typeof rec.name === 'string') return rec.name;
    if (rec.payload && typeof rec.payload === 'object') {
      const p = rec.payload as Record<string, unknown>;
      if (typeof p.channel === 'string') return p.channel;
      if (typeof p.name === 'string') return p.name;
    }
    return null;
  };

  const toggleBarSeries = (key: string) => {
    setHiddenBarSeries((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 1) return prev;
      return [...prev, key];
    });
  };

  const rowPad = settings.tableDensity === 'compact' ? 'py-1.5' : 'py-3';
  const hasChannelFilter = hasDimensionFilter('campaignChannel');

  const renderGroupedBarChart = (heightClass = 'h-[240px] sm:h-[260px]') =>
    groupedChartData.length === 0 ? (
      <div className={`flex ${heightClass} items-center justify-center text-xs text-[#64748B] dark:text-[#94A3B8]`}>
        No campaigns match active cross-filters.
      </div>
    ) : (
      <div className={`${heightClass} w-full min-w-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={groupedChartData} margin={{ top: 10, right: 14, left: -6, bottom: 4 }}>
            <XAxis
              dataKey="name"
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
              cursor={false}
              content={
                <ChartTooltip
                  hint="Click campaign bar to cross-filter by outreach channel"
                  titleOverride={(_label, payload) => {
                    const raw = payload[0]?.payload as { fullName?: string; channel?: string } | undefined;
                    return raw?.fullName ? `${raw.fullName} (${raw.channel ?? ''})` : 'Campaign';
                  }}
                  rowsBuilder={(_label, payload) => {
                    const raw = payload[0]?.payload as
                      | { revenueSavedGBP?: number; campaignCostGBP?: number; roiPct?: number }
                      | undefined;
                    return [
                      {
                        label: 'Revenue Saved',
                        value: formatGBP(Number(raw?.revenueSavedGBP ?? 0)),
                        color: palette.navy,
                      },
                      {
                        label: 'Campaign Cost',
                        value: formatGBP(Number(raw?.campaignCostGBP ?? 0)),
                        color: palette.crimson,
                      },
                      {
                        label: 'Net ROI',
                        value: `${Number(raw?.roiPct ?? 0).toFixed(1)}%`,
                        color: palette.gold,
                      },
                    ];
                  }}
                />
              }
            />
            {!hiddenBarSeries.includes('revenueSavedGBP') && (
              <Bar
                dataKey="revenueSavedGBP"
                radius={[6, 6, 0, 0]}
                barSize={24}
                onMouseEnter={(_d, idx) => setHoveredBarIdx(idx)}
                onMouseLeave={() => setHoveredBarIdx(null)}
                onClick={(entry: unknown) => {
                  const ch = extractChannelFromEntry(entry);
                  if (ch) toggleDimension('campaignChannel', ch, modifierStateRef.current);
                }}
              >
                {groupedChartData.map((entry, idx) => {
                  const hovered = hoveredBarIdx === idx;
                  const dimmed = hoveredBarIdx !== null && !hovered;
                  return (
                    <Cell
                      key={`${entry.name}-saved`}
                      fill={palette.navy}
                      fillOpacity={dimmed ? 0.65 : 1}
                      stroke={hovered ? '#C89B3C' : undefined}
                      strokeWidth={hovered ? 1.5 : 0}
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
            {!hiddenBarSeries.includes('campaignCostGBP') && (
              <Bar
                dataKey="campaignCostGBP"
                radius={[6, 6, 0, 0]}
                barSize={24}
                onMouseEnter={(_d, idx) => setHoveredBarIdx(idx)}
                onMouseLeave={() => setHoveredBarIdx(null)}
                onClick={(entry: unknown) => {
                  const ch = extractChannelFromEntry(entry);
                  if (ch) toggleDimension('campaignChannel', ch, modifierStateRef.current);
                }}
              >
                {groupedChartData.map((entry, idx) => {
                  const hovered = hoveredBarIdx === idx;
                  const dimmed = hoveredBarIdx !== null && !hovered;
                  return (
                    <Cell
                      key={`${entry.name}-cost`}
                      fill={palette.crimson}
                      fillOpacity={dimmed ? 0.65 : 1}
                      stroke={hovered ? '#C89B3C' : undefined}
                      strokeWidth={hovered ? 1.5 : 0}
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

  return (
    <div className="space-y-5 sm:space-y-6" onMouseDownCapture={captureModifiers}>
      {/* Active Cross-Filter Strip */}
      <ActiveCrossFilterBar
        chips={activeCampaignChips}
        multiSelectEnabled={multiSelectEnabled}
        onToggleMultiSelect={() => setMultiSelectEnabled(!multiSelectEnabled)}
        onClearAll={clearCampaignCrossFilters}
        matchingCount={filteredCampaigns.length}
        totalCount={campaigns.length}
        unitLabel="campaigns"
      />

      {/* Interactive KPI & Status Trigger Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          disabled={activeCampaignChips.length === 0}
          onClick={activeCampaignChips.length > 0 ? clearCampaignCrossFilters : undefined}
          className={`text-left rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            activeCampaignChips.length > 0
              ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-[#C89B3C] active:scale-[0.99]'
              : 'cursor-default'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
            <span>Revenue Saved & Net ROI</span>
            <PoundSterling className="h-4 w-4 text-[#94A3B8]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
            {formatCurrencyDisplay(totals.saved, settings.compactCurrency)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
            Spend {formatCurrencyDisplay(totals.cost, settings.compactCurrency)} · ROI {formatPercent(totals.netRoi, 0)} · Lift -{formatPercent(totals.avgLift)}
          </div>
        </button>

        {(
          [
            {
              status: 'Active',
              label: 'Active Campaigns',
              count: statusCounts.Active,
              icon: PlayCircle,
              tone: 'text-[#16325C] dark:text-[#4B7BEC]',
              hint: 'In-flight retention waves',
            },
            {
              status: 'Completed',
              label: 'Completed Campaigns',
              count: statusCounts.Completed,
              icon: CheckCircle2,
              tone: 'text-[#B4821E] dark:text-[#E0B44C]',
              hint: `${formatNumber(totals.retained)} retained of ${formatNumber(totals.contacted)}`,
            },
            {
              status: 'Planned',
              label: 'Planned / Pipeline',
              count: statusCounts.Planned,
              icon: CalendarClock,
              tone: 'text-[#0B1F3A] dark:text-[#F8FAFC]',
              hint: 'Upcoming scheduled plays',
            },
          ] as const
        ).map((card) => {
          const Icon = card.icon;
          const selected = isDimensionSelected('campaignStatus', card.status);
          return (
            <button
              key={card.status}
              type="button"
              onClick={(e) => toggleDimension('campaignStatus', card.status, e)}
              className={`group/kpi relative overflow-hidden text-left rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                selected
                  ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-2 ring-[#C89B3C] dark:ring-[#E0B44C]'
                  : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#C89B3C]'
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#0B1F3A] to-[#C89B3C] opacity-70" />
              <div className="flex items-center justify-between text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                <span>{card.label}</span>
                <div className="flex items-center gap-1.5">
                  <Filter
                    className={`h-3 w-3 transition-colors ${
                      selected ? 'text-[#C89B3C]' : 'text-[#94A3B8] group-hover/kpi:text-[#C89B3C]'
                    }`}
                  />
                  <Icon className="h-4 w-4 text-[#94A3B8]" />
                </div>
              </div>
              <div className={`mt-2 font-display text-2xl font-bold tabular-nums ${card.tone}`}>
                {card.count}
              </div>
              <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                {selected ? 'Active cross-filter (click to clear)' : card.hint}
              </div>
            </button>
          );
        })}
      </section>

      {/* Charts: Grouped Bar (Revenue Saved vs Cost) & Channel ROI Share Donut */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <ChartCard
          className="lg:col-span-7"
          title="Revenue Saved vs. Campaign Cost (£)"
          subtitle="Click any campaign bar to cross-filter by its outreach channel"
          isFiltered={hasChannelFilter}
          onClearFilter={() => {
            clearDimension('campaignChannel');
            notify('Cleared campaign channel filter.', 'info');
          }}
          exportData={groupedChartData as unknown as Array<Record<string, unknown>>}
          exportFilename="campaigns_revenue_vs_cost"
          renderExpanded={() => renderGroupedBarChart('h-full')}
          footer={
            <div className="pt-1">
              <InteractiveLegend
                items={[
                  { key: 'revenueSavedGBP', label: 'Revenue Saved (£)', color: palette.navy },
                  { key: 'campaignCostGBP', label: 'Campaign Cost (£)', color: palette.crimson },
                ]}
                hiddenKeys={hiddenBarSeries}
                onToggle={toggleBarSeries}
              />
            </div>
          }
        >
          {renderGroupedBarChart()}
        </ChartCard>

        {/* Channel ROI Share Donut */}
        <ChartCard
          className="lg:col-span-5 flex flex-col justify-between"
          title="Channel ROI Share"
          subtitle="Hover slice to inspect · Click to filter campaigns"
          isFiltered={hasChannelFilter}
          onClearFilter={() => {
            clearDimension('campaignChannel');
            notify('Cleared campaign channel filter.', 'info');
          }}
          exportData={channelDonutData as unknown as Array<Record<string, unknown>>}
          exportFilename="campaign_channel_roi_share"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative h-[188px] w-[188px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelDonutData}
                    dataKey="valueMetric"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={2}
                    shape={renderExpandedPieSector}
                    onMouseEnter={(_d, idx) => setHoveredDonutIdx(idx)}
                    onMouseLeave={() => setHoveredDonutIdx(null)}
                    onClick={(entry: unknown) => {
                      const ch = extractChannelFromEntry(entry);
                      if (ch) toggleDimension('campaignChannel', ch, modifierStateRef.current);
                    }}
                  >
                    {channelDonutData.map((entry) => {
                      const selected = isDimensionSelected('campaignChannel', entry.name);
                      const dimmed = hasChannelFilter && !selected;
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
                        hint="Click channel slice to filter campaigns"
                        rowsBuilder={(_label, payload) => {
                          const raw = payload[0]?.payload as
                            | { savedGBP?: number; costGBP?: number; roiPct?: number; sharePct?: number }
                            | undefined;
                          return [
                            {
                              label: 'Revenue Saved',
                              value: formatGBP(Number(raw?.savedGBP ?? 0)),
                              color: palette.navy,
                            },
                            {
                              label: 'Campaign Cost',
                              value: formatGBP(Number(raw?.costGBP ?? 0)),
                              color: palette.crimson,
                            },
                            {
                              label: 'Net ROI · Share',
                              value: `${Number(raw?.roiPct ?? 0)}% · ${Number(raw?.sharePct ?? 0).toFixed(1)}%`,
                              color: palette.gold,
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
                  {hoveredDonutItem ? hoveredDonutItem.name : 'Net Saved'}
                </span>
                <span className="font-display text-base font-bold leading-tight text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                  {hoveredDonutItem
                    ? formatGBPCompact(hoveredDonutItem.savedGBP)
                    : formatGBPCompact(totals.saved)}
                </span>
                <span className="font-mono text-[10px] text-[#B4821E] dark:text-[#E0B44C] tabular-nums">
                  {hoveredDonutItem ? `${hoveredDonutItem.sharePct}% share` : `${channelDonutSource.length} plays`}
                </span>
              </div>
            </div>

            <div className="w-full flex-1 space-y-1.5 text-xs min-w-0">
              {channelDonutData.map((item, idx) => {
                const selected = isDimensionSelected('campaignChannel', item.name);
                const dimmed = hasChannelFilter && !selected;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onMouseEnter={() => setHoveredDonutIdx(idx)}
                    onMouseLeave={() => setHoveredDonutIdx(null)}
                    onClick={(e) => toggleDimension('campaignChannel', item.name, e)}
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
                      {item.sharePct}% · {item.roiPct}% ROI
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </ChartCard>
      </section>

      {/* Campaigns Ledger */}
      <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-6 py-4">
          <div>
            <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Retention Campaign Ledger ({filteredCampaigns.length})
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              Persisted locally in IndexedDB across browser sessions
            </p>
          </div>
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-xl bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
          >
            <Plus className="h-3.5 w-3.5 text-[#D4AF37] dark:text-[#040B16]" />
            <span>New Campaign</span>
          </button>
        </div>

        {/* Mobile Card View (< 640px) */}
        <div className="sm:hidden divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
          {filteredCampaigns.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                No campaigns match the active cross-filters.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {activeCampaignChips.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearCampaignCrossFilters();
                      notify('Cleared campaign filters.', 'info');
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#C89B3C] px-4 text-xs font-semibold text-[#0B1F3A] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={openNewModal}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 text-xs font-semibold text-[#0B1F3A] dark:text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Campaign
                </button>
              </div>
            </div>
          ) : (
            filteredCampaigns.map((c) => {
              const roi = safeDivide(c.revenueSavedGBP - c.campaignCostGBP, c.campaignCostGBP) * 100;
              return (
                <div key={c.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-[#0B1F3A] dark:text-[#F8FAFC]">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {c.channel} · {c.status} · {c.targetSegment}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#B4821E] dark:text-[#E0B44C] tabular-nums shrink-0">
                      {formatPercent(roi, 0)} ROI
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#334155] dark:text-[#CBD5E1]">
                    <span>Saved {formatGBP(c.revenueSavedGBP)}</span>
                    <span>Cost {formatGBP(c.campaignCostGBP)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCampaign(c.id)}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-[#8B1E24]/30 px-3 text-xs font-medium text-[#8B1E24] dark:text-[#C93842] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop & Tablet Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
              <tr>
                <th className="sticky left-0 z-10 bg-[#F8FAFC] dark:bg-[#132847] px-4 py-3 font-semibold whitespace-nowrap">
                  Campaign & Offer
                </th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Segment & Channel</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Window</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Retained / Target</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Cost</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Saved</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Net ROI</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Churn Lift</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      No campaigns match the active cross-filters.
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                      {activeCampaignChips.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            clearCampaignCrossFilters();
                            notify('Cleared campaign filters.', 'info');
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#C89B3C] px-4 py-1.5 text-xs font-semibold text-[#0B1F3A] cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openNewModal}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] px-4 py-1.5 text-xs font-semibold text-[#0B1F3A] dark:text-white cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create Campaign
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => {
                  const roi = safeDivide(c.revenueSavedGBP - c.campaignCostGBP, c.campaignCostGBP) * 100;
                  const lift = c.controlChurnPct - c.treatmentChurnPct;
                  return (
                    <tr
                      key={c.id}
                      className="group hover:bg-[#FFFBEB]/45 dark:hover:bg-[#132847]/75 transition-colors"
                    >
                      <td
                        className={`sticky left-0 z-10 bg-white dark:bg-[#0D1E36] group-hover:bg-[#FFFDF5] dark:group-hover:bg-[#132847] px-4 ${rowPad} min-w-[180px]`}
                      >
                        <div className="font-semibold text-[#0B1F3A] dark:text-[#F8FAFC]">{c.name}</div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate max-w-[220px]">
                          {c.offerType}
                        </div>
                      </td>
                      <td className={`px-4 ${rowPad} whitespace-nowrap`}>
                        <div className="text-[#0F172A] dark:text-[#F8FAFC]">{c.targetSegment}</div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {c.channel} · {c.status}
                        </div>
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-[#475569] dark:text-[#94A3B8] whitespace-nowrap font-mono text-[11px]`}
                      >
                        {formatDateUK(c.startDate)} – {formatDateUK(c.endDate)}
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap`}
                      >
                        {c.retained} / {c.targetCustomers}
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono tabular-nums text-[#8B1E24] dark:text-[#C93842] whitespace-nowrap`}
                      >
                        {formatGBP(c.campaignCostGBP)}
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono font-semibold tabular-nums text-[#0B1F3A] dark:text-[#F8FAFC] whitespace-nowrap`}
                      >
                        {formatGBP(c.revenueSavedGBP)}
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono font-semibold tabular-nums text-[#B4821E] dark:text-[#E0B44C] whitespace-nowrap`}
                      >
                        {formatPercent(roi, 0)}
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono font-semibold tabular-nums text-[#16325C] dark:text-[#4B7BEC] whitespace-nowrap`}
                      >
                        -{formatPercent(lift)}
                      </td>
                      <td className={`px-4 ${rowPad} text-right whitespace-nowrap`}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            aria-label="Edit campaign"
                            className="rounded-lg p-1.5 text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#132847] hover:text-[#0B1F3A] dark:hover:text-white cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCampaign(c.id)}
                            aria-label="Delete campaign"
                            className="rounded-lg p-1.5 text-[#475569] dark:text-[#94A3B8] hover:bg-[#FEF2F2] dark:hover:bg-[#8B1E24]/20 hover:text-[#8B1E24] dark:hover:text-[#C93842] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create / Edit Campaign Modal */}
      {modalOpen && editing && (
        <div
          onClick={() => setModalOpen(false)}
          className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1F3A]/45 dark:bg-[#040B16]/70 sm:p-4 backdrop-blur-[2px]"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#0B1F3A] dark:bg-[#040B16] px-5 py-3.5 text-white shrink-0">
              <h3 className="font-display text-sm font-bold">Configure Retention Campaign</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs overflow-y-auto">
              <label className="sm:col-span-2">
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Campaign Name</span>
                <input
                  required
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g., Q4 Fibre Loyalty Save"
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  Target Segment
                </span>
                <select
                  value={editing.targetSegment}
                  onChange={(e) => setEditing({ ...editing, targetSegment: e.target.value })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2.5 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Channel</span>
                <select
                  value={editing.channel}
                  onChange={(e) =>
                    setEditing({ ...editing, channel: e.target.value as RetentionCampaign['channel'] })
                  }
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2.5 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="Outbound Call">Outbound Call</option>
                  <option value="Multi-Channel">Multi-Channel</option>
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="In-App">In-App</option>
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Offer Type</span>
                <input
                  required
                  type="text"
                  value={editing.offerType}
                  onChange={(e) => setEditing({ ...editing, offerType: e.target.value })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Status</span>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as RetentionCampaign['status'] })
                  }
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2.5 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="Planned">Planned</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  Target Customers
                </span>
                <input
                  type="number"
                  min={1}
                  value={editing.targetCustomers}
                  onChange={(e) => setEditing({ ...editing, targetCustomers: Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Contacted</span>
                <input
                  type="number"
                  min={0}
                  value={editing.contacted}
                  onChange={(e) => setEditing({ ...editing, contacted: Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Retained</span>
                <input
                  type="number"
                  min={0}
                  value={editing.retained}
                  onChange={(e) => setEditing({ ...editing, retained: Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  Campaign Cost (£)
                </span>
                <input
                  type="number"
                  min={0}
                  value={editing.campaignCostGBP}
                  onChange={(e) => setEditing({ ...editing, campaignCostGBP: Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  Revenue Saved (£)
                </span>
                <input
                  type="number"
                  min={0}
                  value={editing.revenueSavedGBP}
                  onChange={(e) => setEditing({ ...editing, revenueSavedGBP: Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  Treatment Churn (%)
                </span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={editing.treatmentChurnPct}
                  onChange={(e) => setEditing({ ...editing, treatmentChurnPct: Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>

              <label>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  Control Churn (%)
                </span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={editing.controlChurnPct}
                  onChange={(e) => setEditing({ ...editing, controlChurnPct: Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 font-mono text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-5 py-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-4 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-xl bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] cursor-pointer"
              >
                Save Campaign
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
