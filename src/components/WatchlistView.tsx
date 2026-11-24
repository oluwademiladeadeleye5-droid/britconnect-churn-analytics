import React, { useMemo, useState } from 'react';
import { Eye, Sparkles, ShieldAlert, Clock, Swords, ChevronRight, RotateCcw } from 'lucide-react';
import type {
  AutomatedAlert,
  PlatformSettings,
  ScoredCustomerRecord,
} from '../types/britconnect';
import {
  computeWatchlistAccounts,
  isContractExpiringSoon,
  isHighValueAccount,
} from '../utils/alerts';
import { formatCurrencyDisplay, formatGBP, formatNumber, formatPercent } from '../utils/formatters';

interface WatchlistViewProps {
  customers: ScoredCustomerRecord[];
  alerts: AutomatedAlert[];
  settings: PlatformSettings;
  initialFilter?: string;
  onSelectCustomer: (customer: ScoredCustomerRecord) => void;
  onGeneratePlaybook: (customer: ScoredCustomerRecord) => void;
}

type QueueTab = 'all' | 'critical' | 'expiring' | 'competitor';

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  customers,
  alerts,
  settings,
  initialFilter = 'all',
  onSelectCustomer,
  onGeneratePlaybook,
}) => {
  const [queueTab, setQueueTab] = useState<QueueTab>(
    initialFilter === 'critical' || initialFilter === 'expiring' || initialFilter === 'competitor'
      ? initialFilter
      : 'all'
  );

  React.useEffect(() => {
    if (initialFilter === 'critical' || initialFilter === 'expiring' || initialFilter === 'competitor') {
      setQueueTab(initialFilter);
    }
  }, [initialFilter]);

  const baseQueue = useMemo(() => computeWatchlistAccounts(customers, settings), [customers, settings]);

  const filteredQueue = useMemo(() => {
    if (queueTab === 'critical') {
      return baseQueue.filter((c) => isHighValueAccount(c, settings) && c.riskTier === 'Critical');
    }
    if (queueTab === 'expiring') {
      return baseQueue.filter((c) => isContractExpiringSoon(c, settings));
    }
    if (queueTab === 'competitor') {
      return baseQueue.filter((c) => c['Competitor Offer Received'] === 'Yes');
    }
    return baseQueue;
  }, [baseQueue, queueTab, settings]);

  const totalExposure = useMemo(
    () => filteredQueue.reduce((s, r) => s + r.predictedMonthlyRevenueAtRisk, 0),
    [filteredQueue]
  );

  const rowPad = settings.tableDensity === 'compact' ? 'py-1.5' : 'py-2.5';

  return (
    <div className="space-y-6">
      {/* Automated Alert Strip */}
      {alerts.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {alerts.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 sm:p-5 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-semibold uppercase tracking-wide ${
                    a.severity === 'critical'
                      ? 'text-[#8B1E24] dark:text-[#C93842]'
                      : a.severity === 'warning'
                      ? 'text-[#B4821E] dark:text-[#E0B44C]'
                      : 'text-[#16325C] dark:text-[#4B7BEC]'
                  }`}
                >
                  {a.severity}
                </span>
                <span className="font-mono font-semibold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                  {a.metricBadge}
                </span>
              </div>
              <div className="mt-1.5 font-display text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {a.title}
              </div>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                {a.description}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Priority Queue Table / Mobile Cards */}
      <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-6 py-4">
          <div>
            <h2 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Priority Retention Watchlist
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
              {formatNumber(filteredQueue.length)} accounts queued ·{' '}
              {formatCurrencyDisplay(totalExposure, settings.compactCurrency)}/mo predicted exposure · High-Value
              rule: &ge;£{settings.highValueMonthlyGBP}/mo or &ge;£{settings.highValueLifetimeGBP} LTV
            </p>
          </div>

          <div className="max-w-full overflow-x-auto no-scrollbar">
            <div className="inline-flex rounded-xl bg-[#F1F5F9] dark:bg-[#132847] p-1 gap-1">
              {(
                [
                  { id: 'all', label: `All Priority (${baseQueue.length})`, icon: ShieldAlert },
                  {
                    id: 'critical',
                    label: 'High-Value Critical',
                    icon: ShieldAlert,
                  },
                  {
                    id: 'expiring',
                    label: `Expiring <=${settings.contractExpiryWindowDays}d`,
                    icon: Clock,
                  },
                  {
                    id: 'competitor',
                    label: 'Competitor Offer',
                    icon: Swords,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = queueTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setQueueTab(tab.id)}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                      active
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filteredQueue.length === 0 ? (
          <div className="p-10 sm:p-12 text-center space-y-3">
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              No accounts match this watchlist filter under your current Platform Settings thresholds.
            </p>
            {queueTab !== 'all' && (
              <button
                type="button"
                onClick={() => setQueueTab('all')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#C89B3C] px-4 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Show All Priority Accounts
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Priority Cards (< 640px) */}
            <div className="sm:hidden divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
              {filteredQueue.slice(0, 60).map((c) => {
                const signals: string[] = [];
                if (isHighValueAccount(c, settings)) signals.push('High-Value');
                if (isContractExpiringSoon(c, settings)) signals.push('Expiring');
                if (c['Competitor Offer Received'] === 'Yes') signals.push('Competitor Offer');

                return (
                  <div key={c['Customer ID']} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs font-bold text-[#0B1F3A] dark:text-[#E0B44C]">
                          {c['Customer ID']}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {c.City}, {c['UK Nation']} · {c['Plan Name']}
                        </div>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold tabular-nums ${
                          c.riskTier === 'Critical' || c.riskTier === 'High'
                            ? 'text-[#8B1E24] dark:text-[#C93842]'
                            : 'text-[#B4821E] dark:text-[#E0B44C]'
                        }`}
                      >
                        {formatPercent(c.predictedProbability * 100)} · {c.riskTier}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#334155] dark:text-[#CBD5E1]">
                      <span className="truncate pr-2">{signals.join(' · ') || c.strategicSegment}</span>
                      <span className="font-mono font-semibold text-[#8B1E24] dark:text-[#C93842] tabular-nums shrink-0">
                        {formatGBP(c.predictedMonthlyRevenueAtRisk, 2)}/mo
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(c)}
                        className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> 360° Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => onGeneratePlaybook(c)}
                        className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[#C89B3C] dark:bg-[#E0B44C] px-3 text-xs font-semibold text-[#0B1F3A] cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Playbook
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop & Tablet Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#F8FAFC] dark:bg-[#132847] px-4 py-3 font-semibold whitespace-nowrap">
                      Customer
                    </th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Trigger Signals</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Monthly Charge</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Expiry Window</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Churn Risk</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Monthly Risk</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Primary Driver</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                  {filteredQueue.slice(0, 60).map((c) => {
                    const signals: string[] = [];
                    if (isHighValueAccount(c, settings)) signals.push('High-Value');
                    if (isContractExpiringSoon(c, settings)) signals.push('Expiring');
                    if (c['Competitor Offer Received'] === 'Yes') signals.push('Competitor Offer');

                    return (
                      <tr
                        key={c['Customer ID']}
                        onClick={() => onSelectCustomer(c)}
                        className="group cursor-pointer hover:bg-[#FFFBEB]/45 dark:hover:bg-[#132847]/75 transition-colors"
                      >
                        <td
                          className={`sticky left-0 z-10 bg-white dark:bg-[#0D1E36] group-hover:bg-[#FFFDF5] dark:group-hover:bg-[#132847] px-4 ${rowPad} whitespace-nowrap`}
                        >
                          <div className="font-mono font-semibold text-[#0B1F3A] dark:text-[#E0B44C]">
                            {c['Customer ID']}
                          </div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            {c.City}, {c['UK Nation']} · {c['Plan Name']}
                          </div>
                        </td>
                        <td className={`px-4 ${rowPad} text-[11px] text-[#475569] dark:text-[#94A3B8]`}>
                          {signals.join(' · ') || c.strategicSegment}
                        </td>
                        <td className={`px-4 ${rowPad} text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                          {formatGBP(c['Monthly Charge GBP'], 2)}
                        </td>
                        <td className={`px-4 ${rowPad} text-right font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]`}>
                          {c.Days_To_Contract_Expiry}d
                        </td>
                        <td className={`px-4 ${rowPad} text-right whitespace-nowrap`}>
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              c.riskTier === 'Critical' || c.riskTier === 'High'
                                ? 'text-[#8B1E24] dark:text-[#C93842]'
                                : 'text-[#B4821E] dark:text-[#E0B44C]'
                            }`}
                          >
                            {formatPercent(c.predictedProbability * 100)}
                          </span>
                          <span className="ml-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            · {c.riskTier}
                          </span>
                        </td>
                        <td className={`px-4 ${rowPad} text-right font-mono font-semibold text-[#8B1E24] dark:text-[#C93842] tabular-nums`}>
                          {formatGBP(c.predictedMonthlyRevenueAtRisk, 2)}
                        </td>
                        <td className={`px-4 ${rowPad} text-[#334155] dark:text-[#CBD5E1] max-w-[180px] truncate`}>
                          {c.topRiskDriver}
                        </td>
                        <td className={`px-4 ${rowPad} text-right whitespace-nowrap`}>
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCustomer(c);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2.5 py-1 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] group-hover:border-[#C89B3C] cursor-pointer"
                            >
                              <Eye className="h-3 w-3" /> 360°
                              <ChevronRight className="h-3 w-3 text-[#94A3B8] group-hover:translate-x-0.5 group-hover:text-[#C89B3C] transition-all" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onGeneratePlaybook(c);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#C89B3C] dark:bg-[#E0B44C] px-2.5 py-1 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] cursor-pointer"
                            >
                              <Sparkles className="h-3 w-3" /> Playbook
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
