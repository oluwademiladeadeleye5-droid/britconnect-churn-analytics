import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Megaphone,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import type {
  PlatformSettings,
  RetentionPlaybook,
  ScoredCustomerRecord,
  StrategicSegment,
} from '../types/britconnect';
import { formatGBP, formatPercent, formatTimestamp } from '../utils/formatters';
import { exportPlaybooksMarkdown } from '../utils/exportEngine';
import { useToast } from '../context/ToastContext';

interface PlaybooksViewProps {
  customers: ScoredCustomerRecord[];
  segments: StrategicSegment[];
  playbooks: RetentionPlaybook[];
  settings: PlatformSettings;
  activeTargetCustomer: ScoredCustomerRecord | null;
  activeTargetSegment: StrategicSegment | null;
  onGeneratePlaybook: (
    targetType: 'customer' | 'segment',
    targetId: string
  ) => Promise<void>;
  onDeletePlaybook: (id: string) => void;
  onLaunchCampaign: (playbook: RetentionPlaybook) => void;
  isGenerating: boolean;
  aiError: string | null;
}

export const PlaybooksView: React.FC<PlaybooksViewProps> = ({
  customers,
  segments,
  playbooks,
  settings,
  activeTargetCustomer,
  activeTargetSegment,
  onGeneratePlaybook,
  onDeletePlaybook,
  onLaunchCampaign,
  isGenerating,
  aiError,
}) => {
  const { notify } = useToast();
  const highRiskCustomers = useMemo(
    () =>
      [...customers]
        .sort((a, b) => b.predictedProbability - a.predictedProbability)
        .slice(0, 40),
    [customers]
  );

  const [targetType, setTargetType] = useState<'customer' | 'segment'>(
    activeTargetSegment ? 'segment' : 'customer'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    activeTargetCustomer?.['Customer ID'] ?? highRiskCustomers[0]?.['Customer ID'] ?? ''
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    activeTargetSegment?.id ?? segments[0]?.id ?? ''
  );
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>(playbooks[0]?.id ?? '');

  React.useEffect(() => {
    if (activeTargetCustomer) {
      setTargetType('customer');
      setSelectedCustomerId(activeTargetCustomer['Customer ID']);
    }
  }, [activeTargetCustomer]);

  React.useEffect(() => {
    if (activeTargetSegment) {
      setTargetType('segment');
      setSelectedSegmentId(activeTargetSegment.id);
    }
  }, [activeTargetSegment]);

  React.useEffect(() => {
    if (playbooks.length > 0 && !playbooks.some((p) => p.id === selectedPlaybookId)) {
      setSelectedPlaybookId(playbooks[0].id);
    }
  }, [playbooks, selectedPlaybookId]);

  const currentPlaybook = playbooks.find((p) => p.id === selectedPlaybookId) ?? playbooks[0] ?? null;

  const handleGenerate = async () => {
    const id = targetType === 'customer' ? selectedCustomerId : selectedSegmentId;
    if (!id) return;
    await onGeneratePlaybook(targetType, id);
  };

  return (
    <div className="space-y-6">
      {/* Generator Control Bar */}
      <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3 min-w-0 w-full sm:flex-1 sm:min-w-[280px]">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                AI Retention Playbook Architect
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Synthesize evidence-based UK telecom retention interventions ({settings.defaultPlaybookHorizon} horizon ·
                max {settings.maxDiscountCapPct}% discount cap
                {settings.autoIncludeOfcomCompliance ? ' · Ofcom rules enforced' : ''})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#132847] p-1">
                <button
                  type="button"
                  onClick={() => setTargetType('customer')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                    targetType === 'customer'
                      ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  Individual Customer
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('segment')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                    targetType === 'segment'
                      ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  Strategic Segment
                </button>
              </div>

              {targetType === 'customer' ? (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="h-9 w-full sm:w-auto sm:min-w-[290px] max-w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  {highRiskCustomers.map((c) => (
                    <option key={c['Customer ID']} value={c['Customer ID']}>
                      {c['Customer ID']} · {c.City} · {c['Plan Name']} ({(c.predictedProbability * 100).toFixed(0)}% risk)
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedSegmentId}
                  onChange={(e) => setSelectedSegmentId(e.target.value)}
                  className="h-9 w-full sm:w-auto sm:min-w-[290px] max-w-full rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.customerCount} accounts · {s.avgChurnRiskPct}% avg risk)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {playbooks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  exportPlaybooksMarkdown(playbooks);
                  notify('Exported retention playbooks (.md).');
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3.5 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <Download className="h-4 w-4" />
                <span>Export .md</span>
              </button>
            )}

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#C89B3C] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Generating Playbook...' : 'Generate AI Playbook'}</span>
            </button>
          </div>
        </div>

        {aiError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#8B1E24]/25 bg-[#FEF2F2] dark:bg-[#8B1E24]/20 px-4 py-3 text-xs text-[#8B1E24] dark:text-[#FCA5A5]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>{aiError}</div>
          </div>
        )}
      </section>

      {/* Playbook Workspace: Library List + Structured Detail */}
      {playbooks.length === 0 && !isGenerating ? (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-12 text-center shadow-xs">
          <Sparkles className="mx-auto h-8 w-8 text-[#C89B3C] dark:text-[#E0B44C]" />
          <h3 className="mt-3 font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
            No AI Retention Playbooks Generated Yet
          </h3>
          <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] max-w-md mx-auto">
            Select an at-risk subscriber or strategic segment above and click Generate AI Playbook to build
            a structured intervention plan with ROI projections and measurable KPIs.
          </p>
        </section>
      ) : playbooks.length === 0 && isGenerating ? (
        <section
          aria-busy="true"
          aria-label="Drafting AI retention playbook"
          className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-6 animate-pulse shadow-xs"
        >
          <div className="space-y-2 border-b border-[#E2E8F0] dark:border-[#1E3A5F] pb-4">
            <div className="h-3 w-40 rounded bg-[#E2E8F0] dark:bg-[#132847]" />
            <div className="h-5 w-72 rounded bg-[#CBD5E1] dark:bg-[#1E3A5F]" />
            <div className="h-3 w-56 rounded bg-[#F1F5F9] dark:bg-[#132847]" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-48 rounded bg-[#E2E8F0] dark:bg-[#132847]" />
            <div className="h-3.5 w-full rounded bg-[#F1F5F9] dark:bg-[#132847]" />
            <div className="h-3.5 w-5/6 rounded bg-[#F1F5F9] dark:bg-[#132847]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-24 rounded-xl bg-[#F8FAFC] dark:bg-[#132847]" />
            <div className="h-24 rounded-xl bg-[#F8FAFC] dark:bg-[#132847]" />
          </div>
          <div className="space-y-2.5">
            <div className="h-12 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
            <div className="h-12 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
            <div className="h-12 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
            ))}
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Saved Playbooks List */}
          <div className="lg:col-span-4 space-y-2.5">
            {playbooks.map((pb) => {
              const active = !isGenerating && currentPlaybook?.id === pb.id;
              return (
                <div
                  key={pb.id}
                  onClick={() => setSelectedPlaybookId(pb.id)}
                  className={`cursor-pointer rounded-2xl border bg-white dark:bg-[#0D1E36] p-4 transition-colors shadow-xs ${
                    active
                      ? 'border-[#C89B3C] dark:border-[#E0B44C] ring-1 ring-[#C89B3C] dark:ring-[#E0B44C]'
                      : 'border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#0B1F3A] dark:hover:border-[#E0B44C]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] font-medium text-[#8B1E24] dark:text-[#C93842]">
                      {pb.priorityTier}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlaybook(pb.id);
                      }}
                      aria-label="Delete playbook"
                      className="text-[#94A3B8] hover:text-[#8B1E24] dark:hover:text-[#C93842] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <h4 className="mt-1 font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                    {pb.title}
                  </h4>
                  <div className="mt-1.5 text-xs text-[#475569] dark:text-[#94A3B8]">
                    {pb.targetLabel} · {formatTimestamp(pb.createdAt)}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums pt-2 border-t border-[#F1F5F9] dark:border-[#1E3A5F]">
                    <span className="text-[#16325C] dark:text-[#4B7BEC] font-semibold">
                      Save {formatGBP(pb.expectedImpact.retainedAnnualRevenueGBP)}/yr
                    </span>
                    <span className="text-[#B4821E] dark:text-[#E0B44C] font-semibold">
                      ROI {formatPercent(pb.expectedImpact.projectedNetRoiPct, 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Playbook Structured View */}
          {isGenerating ? (
            <div
              aria-busy="true"
              aria-label="Drafting AI retention playbook"
              className="lg:col-span-8 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-6 animate-pulse shadow-xs"
            >
              <div className="space-y-2 border-b border-[#E2E8F0] dark:border-[#1E3A5F] pb-4">
                <div className="h-3 w-40 rounded bg-[#E2E8F0] dark:bg-[#132847]" />
                <div className="h-5 w-72 rounded bg-[#CBD5E1] dark:bg-[#1E3A5F]" />
                <div className="h-3 w-56 rounded bg-[#F1F5F9] dark:bg-[#132847]" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-48 rounded bg-[#E2E8F0] dark:bg-[#132847]" />
                <div className="h-3.5 w-full rounded bg-[#F1F5F9] dark:bg-[#132847]" />
                <div className="h-3.5 w-5/6 rounded bg-[#F1F5F9] dark:bg-[#132847]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-24 rounded-xl bg-[#F8FAFC] dark:bg-[#132847]" />
                <div className="h-24 rounded-xl bg-[#F8FAFC] dark:bg-[#132847]" />
              </div>
              <div className="space-y-2.5">
                <div className="h-12 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
                <div className="h-12 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
                <div className="h-12 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-[#F8FAFC] dark:bg-[#132847]" />
                ))}
              </div>
            </div>
          ) : (
            currentPlaybook && (
            <div className="lg:col-span-8 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-6 space-y-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E3A5F] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#8B1E24] dark:text-[#C93842] font-semibold">
                    <span>{currentPlaybook.priorityTier}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#475569] dark:text-[#94A3B8]">
                      <Clock className="h-3.5 w-3.5" /> {currentPlaybook.urgencyWindow}
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                    {currentPlaybook.title}
                  </h3>
                  <div className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
                    Target:{' '}
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {currentPlaybook.targetLabel}
                    </span>{' '}
                    · Channel:{' '}
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {currentPlaybook.recommendedChannel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onLaunchCampaign(currentPlaybook)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
                >
                  <Megaphone className="h-3.5 w-3.5 text-[#D4AF37] dark:text-[#040B16]" />
                  <span>Launch as Retention Campaign</span>
                </button>
              </div>

              {/* 1. Evidence-Based Risk Diagnosis */}
              <div>
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                  1. Evidence-Based Risk Diagnosis
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]">
                  {currentPlaybook.evidenceDiagnosis}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-[#0B1F3A] dark:text-[#E0B44C] bg-[#F8FAFC] dark:bg-[#132847] rounded-lg px-3.5 py-2 border border-[#E2E8F0] dark:border-[#1E3A5F] tabular-nums">
                  {currentPlaybook.citedMetrics.map((m, idx) => (
                    <span key={idx}>{m}</span>
                  ))}
                </div>
              </div>

              {/* 2. Recommended Offer & Messaging Angle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#FFFBEB]/40 dark:bg-[#132847] p-4">
                  <div className="text-xs font-bold text-[#0B1F3A] dark:text-[#E0B44C]">
                    2. Recommended Commercial Offer
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]">
                    {currentPlaybook.recommendedOffer}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-4">
                  <div className="text-xs font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                    Messaging & Tone Angle
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#334155] dark:text-[#CBD5E1]">
                    {currentPlaybook.messagingAngle}
                  </p>
                </div>
              </div>

              {/* 3. Step-by-Step Implementation Plan */}
              <div>
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] mb-2.5">
                  3. Step-by-Step Implementation Plan
                </h4>
                <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F] rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F]">
                  {currentPlaybook.implementationSteps.map((step) => (
                    <div
                      key={step.stepNumber}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] dark:bg-[#E0B44C] font-mono text-[11px] font-bold text-white dark:text-[#040B16]">
                          {step.stepNumber}
                        </span>
                        <div>
                          <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{step.action}</div>
                          <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            Owner:{' '}
                            <span className="font-medium text-[#0B1F3A] dark:text-[#F8FAFC]">
                              {step.responsibleTeam}
                            </span>{' '}
                            · Channel: {step.channel}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#B4821E] dark:text-[#E0B44C] shrink-0">
                        <ArrowRight className="h-3 w-3" /> {step.timeline}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Expected Business Impact */}
              <div>
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] mb-2.5">
                  4. Expected Commercial Impact
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    {
                      label: 'Churn Reduction',
                      val: formatPercent(currentPlaybook.expectedImpact.churnReductionPct),
                    },
                    {
                      label: 'Retained / Mo',
                      val: formatGBP(currentPlaybook.expectedImpact.retainedMonthlyRevenueGBP),
                    },
                    {
                      label: 'Retained / Yr',
                      val: formatGBP(currentPlaybook.expectedImpact.retainedAnnualRevenueGBP),
                    },
                    {
                      label: 'Intervention Cost',
                      val: formatGBP(currentPlaybook.expectedImpact.estimatedInterventionCostGBP),
                    },
                    {
                      label: 'Projected Net ROI',
                      val: formatPercent(currentPlaybook.expectedImpact.projectedNetRoiPct, 0),
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] p-3"
                    >
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{m.label}</div>
                      <div className="mt-1 font-mono text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                        {m.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Measurable KPIs */}
              <div>
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] mb-2.5">
                  5. Measurable Retention KPIs
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {currentPlaybook.measurableKpis.map((kpi, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] dark:bg-[#132847]/60 p-3 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-[#16325C] dark:text-[#E0B44C]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#C89B3C] dark:text-[#E0B44C]" />
                        <span>{kpi.horizon}</span>
                      </div>
                      <div className="mt-1 font-medium text-[#0F172A] dark:text-[#F8FAFC]">{kpi.metric}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-[#475569] dark:text-[#94A3B8]">
                        {kpi.target}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )
          )}
        </section>
      )}
    </div>
  );
};
