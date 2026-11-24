import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sector, type PieSectorShapeProps } from 'recharts';
import { Download, Maximize2, RotateCcw, X } from 'lucide-react';
import { exportChartDataCSV } from '../utils/exportEngine';
import { useToast } from '../context/ToastContext';

export interface TooltipMetricRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  hint?: string;
  titleOverride?: (label: string | number | undefined, payload: TooltipPayloadItem[]) => string;
  rowsBuilder?: (
    label: string | number | undefined,
    payload: TooltipPayloadItem[]
  ) => TooltipMetricRow[];
  noteBuilder?: (
    label: string | number | undefined,
    payload: TooltipPayloadItem[]
  ) => string | null;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  label,
  payload,
  hint,
  titleOverride,
  rowsBuilder,
  noteBuilder,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const firstPayload = payload[0]?.payload;
  const resolvedTitle = titleOverride
    ? titleOverride(label, payload)
    : String(
        label ??
          (firstPayload && typeof firstPayload.name === 'string'
            ? firstPayload.name
            : payload[0]?.name ?? '')
      );

  const rows: TooltipMetricRow[] = rowsBuilder
    ? rowsBuilder(label, payload)
    : payload.map((item) => ({
        label: String(item.name ?? 'Value'),
        value: String(item.value ?? '—'),
        color: item.color,
      }));

  const note = noteBuilder ? noteBuilder(label, payload) : null;

  return (
    <div className="pointer-events-none min-w-[190px] max-w-[290px] rounded-xl border border-[#C89B3C]/40 bg-[#0B1F3A]/96 dark:bg-[#040B16]/96 px-3.5 py-2.5 text-xs text-[#F8FAFC] shadow-2xl backdrop-blur-md">
      {resolvedTitle && (
        <div className="mb-1.5 border-b border-white/10 pb-1.5 font-display text-[12px] font-bold text-[#F8FAFC] leading-snug">
          {resolvedTitle}
        </div>
      )}

      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 truncate">
              {r.color && (
                <span
                  className="h-2 w-2 rounded-[2px] shrink-0"
                  style={{ backgroundColor: r.color }}
                />
              )}
              <span className="truncate">{r.label}</span>
            </span>
            <span className="font-mono text-[11px] font-semibold text-white tabular-nums shrink-0">
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {note && (
        <div className="mt-2 border-t border-white/10 pt-1.5 text-[11px] leading-relaxed text-slate-300">
          {note}
        </div>
      )}

      {hint && (
        <div className="mt-1.5 border-t border-white/10 pt-1 text-[10px] font-medium text-[#E0B44C]">
          {hint}
        </div>
      )}
    </div>
  );
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  headerRight?: React.ReactNode;
  exportData?: Array<Record<string, unknown>>;
  exportFilename?: string;
  isFiltered?: boolean;
  onClearFilter?: () => void;
  children: React.ReactNode;
  renderExpanded?: () => React.ReactNode;
  footer?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  className = '',
  headerRight,
  exportData,
  exportFilename,
  isFiltered = false,
  onClearFilter,
  children,
  renderExpanded,
  footer,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  const handleExport = () => {
    if (!exportData || exportData.length === 0) {
      notify('No chart data available to export.', 'info');
      return;
    }
    const slug = exportFilename || title.toLowerCase().replace(/\s+/g, '_');
    exportChartDataCSV(exportData, slug);
    notify(`Exported "${title}" CSV data.`);
  };

  return (
    <>
      <div
        className={`group/chart min-w-0 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC] leading-snug">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#475569] dark:text-[#94A3B8] leading-snug">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {headerRight}

            {/* Per-Chart Micro-Toolbar */}
            <div className="inline-flex items-center gap-1 opacity-100 sm:opacity-70 sm:group-hover/chart:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
              {isFiltered && onClearFilter && (
                <button
                  type="button"
                  onClick={onClearFilter}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-[#C89B3C]/60 dark:border-[#E0B44C]/60 bg-[#FFFBEB] dark:bg-[#132847] px-2.5 py-1 text-[11px] font-semibold text-[#B4821E] dark:text-[#E0B44C] hover:border-[#C89B3C] hover:bg-[#FEF3C7]/60 dark:hover:bg-[#1E3A5F] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear Filter</span>
                </button>
              )}

              {exportData && (
                <button
                  type="button"
                  onClick={handleExport}
                  title="Export chart data as CSV"
                  aria-label={`Export ${title} CSV`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] text-[#475569] dark:text-[#94A3B8] hover:border-[#C89B3C] hover:text-[#0B1F3A] dark:hover:text-[#E0B44C] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setExpanded(true)}
                title="Expand chart focus view"
                aria-label={`Expand ${title}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] text-[#475569] dark:text-[#94A3B8] hover:border-[#C89B3C] hover:text-[#0B1F3A] dark:hover:text-[#E0B44C] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3">{children}</div>
        {footer && <div className="mt-3">{footer}</div>}
      </div>

      {/* Expanded Presentation Focus Modal */}
      <AnimatePresence>
        {expanded && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setExpanded(false)}
              className="no-print fixed inset-0 z-50 bg-[#040B16]/65 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="no-print fixed left-1/2 top-1/2 z-50 w-[94%] max-w-5xl max-h-[88dvh] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-5 sm:px-6 py-4 bg-[#F8FAFC] dark:bg-[#0B1F3A] shrink-0">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC] truncate">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8] truncate">{subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {exportData && (
                    <button
                      type="button"
                      onClick={handleExport}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#C89B3C] transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Export CSV</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-label="Close expanded chart"
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] text-[#475569] dark:text-[#94A3B8] hover:text-[#0B1F3A] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 sm:p-7">
                <div className="h-[52dvh] min-h-[320px] w-full min-w-0">
                  {renderExpanded ? renderExpanded() : children}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export interface InteractiveLegendItem {
  key: string;
  label: string;
  color: string;
}

interface InteractiveLegendProps {
  items: InteractiveLegendItem[];
  hiddenKeys: string[];
  onToggle: (key: string) => void;
}

export const InteractiveLegend: React.FC<InteractiveLegendProps> = ({
  items,
  hiddenKeys,
  onToggle,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const isHidden = hiddenKeys.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={!isHidden}
            className={`inline-flex min-h-[34px] sm:min-h-[28px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
              isHidden
                ? 'opacity-45 line-through bg-[#F1F5F9] dark:bg-[#132847]/60 text-[#64748B] dark:text-[#94A3B8]'
                : 'bg-[#F8FAFC] dark:bg-[#132847] text-[#0F172A] dark:text-[#F8FAFC] hover:ring-1 hover:ring-[#C89B3C]/60'
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-[3px] shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export const renderExpandedPieSector = (props: PieSectorShapeProps) => {
  const baseOuter = Number(props.outerRadius ?? 72);
  const expandedOuter = props.isActive ? baseOuter + 6 : baseOuter;
  return (
    <Sector
      cx={props.cx}
      cy={props.cy}
      innerRadius={props.innerRadius}
      outerRadius={expandedOuter}
      startAngle={props.startAngle}
      endAngle={props.endAngle}
      cornerRadius={props.cornerRadius}
      fill={props.fill}
      fillOpacity={props.fillOpacity}
      stroke={props.isActive ? '#C89B3C' : props.stroke}
      strokeWidth={props.isActive ? 2 : props.strokeWidth}
      style={{
        cursor: 'pointer',
        filter: props.isActive ? 'brightness(1.08)' : undefined,
        transition: 'all 150ms ease',
      }}
    />
  );
};

export function explainFeatureDriver(
  featureKey: string,
  direction?: 'risk' | 'protective' | 'nonlinear',
  contribution?: number
): string {
  const dir =
    direction ?? (typeof contribution === 'number' && contribution < 0 ? 'protective' : 'risk');
  const key = featureKey.toLowerCase();

  if (dir === 'nonlinear') {
    if (key.includes('contract') || key.includes('month_to_month')) {
      return 'Tree splits show non-linear churn spikes on month-to-month terms or approaching contract expiry.';
    }
    if (key.includes('tenure')) {
      return 'Non-linear tree splits show elevated churn risk in early months that plateaus at longer tenures.';
    }
    if (key.includes('satisfaction') || key.includes('csat') || key.includes('nps')) {
      return 'Tree splits show sharp churn escalation below critical satisfaction and NPS thresholds.';
    }
    if (key.includes('complaint') || key.includes('ticket') || key.includes('friction') || key.includes('resolution')) {
      return 'Tree splits capture compounding churn risk once complaint or support friction crosses threshold levels.';
    }
    if (key.includes('outage') || key.includes('network')) {
      return 'Non-linear tree thresholds flag steep cancellation risk after repeated service outages.';
    }
    if (key.includes('overage')) {
      return 'Non-linear splits show sharp bill-shock sensitivity once monthly overage charges spike.';
    }
    return 'Non-linear tree splits capture threshold-based churn shifts across high and low ranges of this driver.';
  }

  if (key.includes('contract') || key.includes('month_to_month')) {
    return dir === 'risk'
      ? 'Flexible month-to-month or expiring terms let customers switch without exit friction.'
      : 'Longer fixed-term lock-in significantly reduces near-term switching probability.';
  }
  if (key.includes('tenure')) {
    return dir === 'risk'
      ? 'Early-tenure subscribers have not yet formed strong billing or habit anchoring.'
      : 'Established multi-year tenure correlates strongly with lower voluntary churn.';
  }
  if (key.includes('satisfaction') || key.includes('csat') || key.includes('nps')) {
    return dir === 'risk'
      ? 'Lower customer satisfaction or detractor NPS signals unresolved service frustration.'
      : 'High satisfaction and promoter NPS act as strong loyalty buffers against competitor offers.';
  }
  if (key.includes('complaint') || key.includes('ticket') || key.includes('friction') || key.includes('resolution')) {
    return dir === 'risk'
      ? 'Repeated complaints, support tickets, or slow resolution hours erode service trust.'
      : 'Low support friction and fast resolution reinforce day-to-day service reliability.';
  }
  if (key.includes('outage') || key.includes('network')) {
    return dir === 'risk'
      ? 'Recent broadband/mobile outages trigger immediate reliability-driven cancellation.'
      : 'Stable network uptime supports uninterrupted household or business connectivity.';
  }
  if (key.includes('overage')) {
    return dir === 'risk'
      ? 'Unexpected out-of-bundle overage charges create bill shock and price sensitivity.'
      : 'Predictable monthly billing with minimal overage keeps spend expectations steady.';
  }
  if (key.includes('competitor')) {
    return dir === 'risk'
      ? 'Active competitor promotional offers create immediate price-switch temptation.'
      : 'No active competitor solicitation lowers near-term switching urgency.';
  }
  if (key.includes('auto_renew') || key.includes('direct_debit') || key.includes('payment')) {
    return dir === 'risk'
      ? 'Manual billing or disabled auto-renew increases lapse risk at renewal.'
      : 'Direct Debit and active auto-renewal create seamless retention continuity.';
  }
  if (key.includes('discount')) {
    return dir === 'risk'
      ? 'Minimal loyalty discounting leaves headline tariff vulnerable to rivals.'
      : 'Targeted loyalty discounting improves perceived commercial value.';
  }
  if (key.includes('data') || key.includes('arpu') || key.includes('charge') || key.includes('spend')) {
    return dir === 'risk'
      ? 'High spend or mismatched data utilization increases tariff value scrutiny.'
      : 'Healthy usage-to-price alignment reinforces perceived plan value.';
  }

  return dir === 'risk'
    ? 'Elevated exposure on this telemetry driver pushes predicted churn probability upward.'
    : 'Favourable standing on this driver pulls predicted churn risk downward.';
}
