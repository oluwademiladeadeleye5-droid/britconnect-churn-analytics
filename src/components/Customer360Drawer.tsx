import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { X, Sparkles, Sliders, RotateCcw } from 'lucide-react';
import type {
  PlatformSettings,
  ScoredCustomerRecord,
  TrainedModelBundle,
} from '../types/britconnect';
import { simulateWhatIf } from '../utils/mlEngine';
import { formatDateUK, formatGBP, formatPercent } from '../utils/formatters';
import { getChartThemePalette } from '../utils/settings';
import { ChartTooltip, explainFeatureDriver } from './ChartUI';

interface Customer360DrawerProps {
  customer: ScoredCustomerRecord | null;
  modelBundle: TrainedModelBundle;
  settings: PlatformSettings;
  isDark: boolean;
  onClose: () => void;
  onGeneratePlaybook: (customer: ScoredCustomerRecord) => void;
}

export const Customer360Drawer: React.FC<Customer360DrawerProps> = ({
  customer,
  modelBundle,
  settings,
  isDark,
  onClose,
  onGeneratePlaybook,
}) => {
  const [discountPercent, setDiscountPercent] = useState(0);
  const [contractType, setContractType] = useState('Month-to-Month');
  const [autoRenew, setAutoRenew] = useState<'Yes' | 'No'>('Yes');
  const [satisfactionScore, setSatisfactionScore] = useState(7);
  const [overageChargesGBP, setOverageChargesGBP] = useState(0);
  const [hoveredDriverIdx, setHoveredDriverIdx] = useState<number | null>(null);

  const palette = useMemo(() => getChartThemePalette(isDark), [isDark]);
  const maxDiscount = Math.max(10, Math.min(50, settings.maxDiscountCapPct));

  useEffect(() => {
    if (!customer) return;
    setDiscountPercent(Math.min(maxDiscount, customer['Discount Percent']));
    setContractType(customer['Contract Type']);
    setAutoRenew(customer['Auto Renew']);
    setSatisfactionScore(customer['Satisfaction Score 1 10']);
    setOverageChargesGBP(customer['Overage Charges GBP']);
    setHoveredDriverIdx(null);
  }, [customer, maxDiscount]);

  useEffect(() => {
    if (!customer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [customer, onClose]);

  const simResult = useMemo(() => {
    if (!customer) return null;
    return simulateWhatIf(
      customer,
      {
        discountPercent,
        contractType,
        autoRenew,
        satisfactionScore,
        overageChargesGBP,
      },
      modelBundle,
      settings
    );
  }, [
    customer,
    discountPercent,
    contractType,
    autoRenew,
    satisfactionScore,
    overageChargesGBP,
    modelBundle,
    settings,
  ]);

  const resetSim = () => {
    if (!customer) return;
    setDiscountPercent(Math.min(maxDiscount, customer['Discount Percent']));
    setContractType(customer['Contract Type']);
    setAutoRenew(customer['Auto Renew']);
    setSatisfactionScore(customer['Satisfaction Score 1 10']);
    setOverageChargesGBP(customer['Overage Charges GBP']);
  };

  const localBars = simResult ? simResult.localContributions.slice(0, 8) : [];

  return (
    <AnimatePresence>
      {customer && simResult && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="no-print fixed inset-0 z-40 bg-[#0B1F3A]/45 dark:bg-[#040B16]/60 backdrop-blur-[2px]"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="no-print fixed inset-x-0 bottom-0 h-[92dvh] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto z-50 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-none bg-white dark:bg-[#0D1E36] border-t sm:border-t-0 sm:border-l border-[#E2E8F0] dark:border-[#1E3A5F] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-6 py-3.5 sm:py-4 bg-[#0B1F3A] dark:bg-[#040B16] text-white shrink-0">
              <div className="min-w-0 pr-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-300">
                  <span className="font-mono font-semibold text-[#D4AF37] dark:text-[#E0B44C]">
                    {customer['Customer ID']}
                  </span>
                  <span>·</span>
                  <span>{customer['Customer Segment']}</span>
                  <span>·</span>
                  <span>
                    {customer.City}, {customer['UK Nation']}
                  </span>
                </div>
                <h2 className="mt-0.5 font-display text-sm sm:text-base font-bold text-white truncate">
                  {customer['Plan Name']} ({customer['Service Type']})
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close customer profile"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
              {/* Top Risk & Revenue Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] dark:bg-[#132847] p-3.5">
                  <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">Baseline Risk</div>
                  <div
                    className={`mt-1 font-display text-xl font-bold tabular-nums ${
                      customer.riskTier === 'Critical' || customer.riskTier === 'High'
                        ? 'text-[#8B1E24] dark:text-[#C93842]'
                        : customer.riskTier === 'Medium'
                        ? 'text-[#B4821E] dark:text-[#E0B44C]'
                        : 'text-[#16325C] dark:text-[#4B7BEC]'
                    }`}
                  >
                    {formatPercent(customer.predictedProbability * 100)}
                  </div>
                  <div className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    {customer.riskTier} Tier
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] dark:bg-[#132847] p-3.5">
                  <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">Monthly Charge</div>
                  <div className="mt-1 font-display text-xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                    {formatGBP(customer['Monthly Charge GBP'], 2)}
                  </div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Overage {formatGBP(customer['Overage Charges GBP'], 2)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] dark:bg-[#132847] p-3.5">
                  <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">Rev at Risk / Mo</div>
                  <div className="mt-1 font-display text-xl font-bold text-[#8B1E24] dark:text-[#C93842] tabular-nums">
                    {formatGBP(customer.predictedMonthlyRevenueAtRisk, 2)}
                  </div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    LTV {formatGBP(customer['Lifetime Revenue GBP'], 0)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] dark:bg-[#132847] p-3.5">
                  <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">Tenure & Expiry</div>
                  <div className="mt-1 font-display text-xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                    {customer['Tenure Months']}m
                  </div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Ends {formatDateUK(customer['Contract End Date'])}
                  </div>
                </div>
              </div>

              {/* Telemetry Grid */}
              <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                <h3 className="font-display text-xs font-bold text-[#0B1F3A] dark:text-[#F8FAFC] mb-3">
                  Subscriber Telemetry & Service Experience
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-xs">
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Contract:</span>{' '}
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      {customer['Contract Type']}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Auto Renew / DD:</span>{' '}
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      {customer['Auto Renew']} / {customer['Direct Debit']}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Competitor Offer:</span>{' '}
                    <span
                      className={`font-semibold ${
                        customer['Competitor Offer Received'] === 'Yes'
                          ? 'text-[#8B1E24] dark:text-[#C93842]'
                          : 'text-[#0F172A] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {customer['Competitor Offer Received']}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Support Tickets 12M:</span>{' '}
                    <span className="font-mono font-medium tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {customer['Support Tickets 12M']}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Complaints 12M:</span>{' '}
                    <span className="font-mono font-medium tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {customer['Complaints 12M']}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Avg Resolution:</span>{' '}
                    <span className="font-mono font-medium tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {customer['Average Resolution Hours']}h
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Network Outages 12M:</span>{' '}
                    <span className="font-mono font-medium tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {customer['Network Outages 12M']}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">CSAT / NPS:</span>{' '}
                    <span className="font-mono font-medium tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {customer['Satisfaction Score 1 10']}/10 ({customer['NPS Score']})
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Data Utilization:</span>{' '}
                    <span className="font-mono font-medium tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {(customer.Data_Utilization_Ratio * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Local SHAP-style Waterfall Contributions */}
              <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847]/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                      Local Churn Driver Breakdown
                    </h3>
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                      Hover any driver bar for plain-English rationale (simulated live)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: palette.crimson }} /> Risk
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: palette.gold }} /> Protective
                    </span>
                  </div>
                </div>

                <div className="h-56 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={localBars}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
                    >
                      <XAxis
                        type="number"
                        axisLine={{ stroke: palette.axisStroke }}
                        tickLine={false}
                        tick={{ fill: palette.tickFill, fontSize: 10 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={165}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: palette.labelFill, fontSize: 11 }}
                      />
                      <ReferenceLine x={0} stroke={palette.axisStroke} />
                      <Tooltip
                        cursor={false}
                        content={
                          <ChartTooltip
                            rowsBuilder={(_label, payload) => {
                              const raw = payload[0]?.payload as
                                | { contribution?: number; customerValue?: string }
                                | undefined;
                              const contrib = Number(raw?.contribution ?? 0);
                              return [
                                {
                                  label: 'Log-Odds Impact',
                                  value: `${contrib > 0 ? '+' : ''}${contrib.toFixed(3)}`,
                                  color: contrib >= 0 ? palette.crimson : palette.gold,
                                },
                                {
                                  label: 'Subscriber Value',
                                  value: raw?.customerValue ?? '—',
                                  color: palette.navy,
                                },
                              ];
                            }}
                            noteBuilder={(_label, payload) => {
                              const raw = payload[0]?.payload as
                                | { feature?: string; label?: string; contribution?: number }
                                | undefined;
                              return explainFeatureDriver(
                                raw?.feature ?? raw?.label ?? '',
                                undefined,
                                raw?.contribution
                              );
                            }}
                          />
                        }
                      />
                      <Bar
                        dataKey="contribution"
                        radius={[4, 4, 4, 4]}
                        barSize={14}
                        onMouseEnter={(_d, idx) => setHoveredDriverIdx(idx)}
                        onMouseLeave={() => setHoveredDriverIdx(null)}
                      >
                        {localBars.map((c, idx) => {
                          const hovered = hoveredDriverIdx === idx;
                          const dimmed = hoveredDriverIdx !== null && !hovered;
                          return (
                            <Cell
                              key={c.feature}
                              fill={c.contribution >= 0 ? palette.crimson : palette.gold}
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
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Interactive What-If Simulator */}
              <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[#0B1F3A] dark:text-[#E0B44C]" />
                    <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                      Interactive Retention What-If Simulator
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={resetSim}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0B1F3A] dark:hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                </div>

                {/* Live Comparison Banner */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-4 py-3">
                  <div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Simulated Churn Risk</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                        {formatPercent(simResult.probability * 100)}
                      </span>
                      <span className="font-mono text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
                        ({simResult.probability - customer.predictedProbability <= 0 ? '' : '+'}
                        {((simResult.probability - customer.predictedProbability) * 100).toFixed(1)} pts)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Simulated Monthly Rev at Risk
                    </div>
                    <div className="font-mono text-base font-bold text-[#16325C] dark:text-[#E0B44C] tabular-nums">
                      {formatGBP(simResult.predictedMonthlyRevenueAtRisk, 2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                        Loyalty Discount (Max {maxDiscount}%)
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-[#0F172A] dark:text-[#E0B44C]">
                        {discountPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxDiscount}
                      step={5}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      className="w-full accent-[#0B1F3A] dark:accent-[#E0B44C] cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Target CSAT Score</span>
                      <span className="font-mono font-semibold tabular-nums text-[#0F172A] dark:text-[#E0B44C]">
                        {satisfactionScore} / 10
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={satisfactionScore}
                      onChange={(e) => setSatisfactionScore(Number(e.target.value))}
                      className="w-full accent-[#C89B3C] dark:accent-[#E0B44C] cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Overage Charges (£)</span>
                      <span className="font-mono font-semibold tabular-nums text-[#0F172A] dark:text-[#C93842]">
                        {formatGBP(overageChargesGBP, 2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={1}
                      value={overageChargesGBP}
                      onChange={(e) => setOverageChargesGBP(Number(e.target.value))}
                      className="w-full accent-[#8B1E24] dark:accent-[#C93842] cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Contract</span>
                      <select
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value)}
                        className="h-8 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
                      >
                        <option value="Month-to-Month">Month-to-Month</option>
                        <option value="12-Month">12-Month</option>
                        <option value="24-Month">24-Month</option>
                      </select>
                    </label>
                    <label>
                      <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1">Auto Renew</span>
                      <select
                        value={autoRenew}
                        onChange={(e) => setAutoRenew(e.target.value as 'Yes' | 'No')}
                        className="h-8 w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="border-t border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-[#0D1E36] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Segment:{' '}
                <span className="font-semibold text-[#0B1F3A] dark:text-[#F8FAFC]">
                  {customer.strategicSegment}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onGeneratePlaybook(customer)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#C89B3C] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate AI Retention Playbook</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
