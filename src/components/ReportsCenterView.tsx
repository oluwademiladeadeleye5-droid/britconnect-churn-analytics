import React, { useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  FileJson,
  Printer,
  Sparkles,
  Download,
  AlertCircle,
} from 'lucide-react';
import type { DatasetSnapshot } from '../types/britconnect';
import { computeDashboardCharts, computeDashboardKPIs } from '../utils/analytics';
import {
  exportCampaignPackCSV,
  exportCampaignSegmentPackJSON,
  exportPlaybooksMarkdown,
  exportRiskRegisterCSV,
  exportRiskRegisterExcel,
} from '../utils/exportEngine';
import { formatGBP, formatNumber, formatPercent, formatTimestamp } from '../utils/formatters';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useToast } from '../context/ToastContext';

interface ReportsCenterViewProps {
  snapshot: DatasetSnapshot;
  onGenerateExecutiveSummary: () => Promise<void>;
  isGeneratingSummary: boolean;
  summaryError: string | null;
}

export const ReportsCenterView: React.FC<ReportsCenterViewProps> = ({
  snapshot,
  onGenerateExecutiveSummary,
  isGeneratingSummary,
  summaryError,
}) => {
  const { notify } = useToast();
  const kpis = useMemo(() => computeDashboardKPIs(snapshot.scoredRows), [snapshot.scoredRows]);
  const charts = useMemo(() => computeDashboardCharts(snapshot.scoredRows), [snapshot.scoredRows]);
  const champion = snapshot.modelBundle.models[snapshot.modelBundle.championModelId];

  return (
    <div className="space-y-6">
      {/* Export Cards */}
      <section className="no-print grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <FileSpreadsheet className="h-5 w-5 text-[#0B1F3A] dark:text-[#4B7BEC]" />
            <h3 className="mt-3 font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Scored Customer Risk Register
            </h3>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Full subscriber dataset enriched with 10 engineered features, ML Churn Probability, Risk Tier, and Top Risk Driver.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                exportRiskRegisterExcel(snapshot.scoredRows, snapshot.metadata.datasetName);
                notify('Exported Risk Register (.xlsx).');
              }}
              className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] px-3 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Download className="h-3.5 w-3.5" /> .xlsx
            </button>
            <button
              type="button"
              onClick={() => {
                exportRiskRegisterCSV(snapshot.scoredRows, snapshot.metadata.datasetName);
                notify('Exported Risk Register (.csv).');
              }}
              className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Download className="h-3.5 w-3.5" /> .csv
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <Printer className="h-5 w-5 text-[#C89B3C] dark:text-[#E0B44C]" />
            <h3 className="mt-3 font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Executive Churn Intelligence PDF
            </h3>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Boardroom-ready report below combining live UK KPIs, regional tables, ML benchmarks, and Gemini AI narrative.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                notify('Opening browser print dialog for PDF export.', 'info');
                window.print();
              }}
              className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#C89B3C] dark:bg-[#E0B44C] px-3 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <FileJson className="h-5 w-5 text-[#16325C] dark:text-[#4B7BEC]" />
            <h3 className="mt-3 font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              Campaign & Segment Pack
            </h3>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Export all 5 strategic UK customer segments and live retention campaign ROI ledgers.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                exportCampaignPackCSV(snapshot.campaigns);
                notify('Exported campaign pack (.csv).');
              }}
              className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Download className="h-3.5 w-3.5" /> .csv
            </button>
            <button
              type="button"
              onClick={() => {
                exportCampaignSegmentPackJSON(snapshot.segments, snapshot.campaigns);
                notify('Exported campaign & segment pack (.json).');
              }}
              className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Download className="h-3.5 w-3.5" /> .json
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 flex flex-col justify-between shadow-xs">
          <div>
            <FileText className="h-5 w-5 text-[#8B1E24] dark:text-[#C93842]" />
            <h3 className="mt-3 font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              AI Retention Playbooks
            </h3>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Download all saved evidence-based retention playbooks ({snapshot.playbooks.length} saved) in Markdown format.
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              disabled={snapshot.playbooks.length === 0}
              onClick={() => {
                exportPlaybooksMarkdown(snapshot.playbooks);
                notify('Exported retention playbooks (.md).');
              }}
              className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Download className="h-3.5 w-3.5" /> Download Playbooks (.md)
            </button>
          </div>
        </div>
      </section>

      {/* Printable Executive Churn Intelligence Brief */}
      <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] bg-white dark:bg-[#0D1E36] print:bg-white p-4 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] pb-5">
          <div>
            <div className="text-xs font-semibold text-[#C89B3C] dark:text-[#E0B44C] print:text-[#C89B3C] uppercase tracking-wider">
              BritConnect Executive Briefing
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] print:text-[#0B1F3A]">
              UK Telecommunications Customer Churn Intelligence Report
            </h2>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] print:text-[#475569]">
              Dataset: {snapshot.metadata.datasetName} · {formatNumber(kpis.totalCustomers)} Subscribers · Champion Model:{' '}
              {champion.name} (ROC-AUC {champion.rocAuc.toFixed(3)}) · Generated {formatTimestamp(new Date().toISOString())}
            </p>
          </div>

          <button
            type="button"
            disabled={isGeneratingSummary}
            onClick={onGenerateExecutiveSummary}
            className="no-print inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
          >
            <Sparkles className={`h-3.5 w-3.5 text-[#D4AF37] dark:text-[#040B16] ${isGeneratingSummary ? 'animate-spin' : ''}`} />
            <span>{isGeneratingSummary ? 'Drafting Narrative...' : 'Generate AI Executive Narrative'}</span>
          </button>
        </div>

        {summaryError && (
          <div className="no-print flex items-start gap-2 rounded-lg border border-[#8B1E24]/25 bg-[#FEF2F2] dark:bg-[#8B1E24]/20 px-4 py-3 text-xs text-[#8B1E24] dark:text-[#FCA5A5]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{summaryError}</span>
          </div>
        )}

        {/* Executive KPI Grid */}
        <div className="print-break-inside-avoid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Accounts', val: formatNumber(kpis.totalCustomers) },
            { label: 'Observed Churn', val: formatPercent(kpis.churnRatePct) },
            { label: 'Monthly Rev at Risk', val: formatGBP(kpis.predictedMonthlyRevenueAtRiskGBP) },
            { label: 'Total Lifetime Rev', val: formatGBP(kpis.totalLifetimeRevenueGBP) },
            { label: 'High/Critical Risk', val: formatNumber(kpis.highCriticalRiskCount) },
            { label: 'Mean CSAT / NPS', val: `${kpis.avgSatisfaction}/10 (${kpis.avgNps})` },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] bg-[#F8FAFC] dark:bg-[#132847] print:bg-[#F8FAFC] p-3"
            >
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] print:text-[#64748B]">
                {item.label}
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC] print:text-[#0B1F3A] tabular-nums">
                {item.val}
              </div>
            </div>
          ))}
        </div>

        {/* AI Narrative Section */}
        <div className="print-break-inside-avoid rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] bg-[#F8FAFC] dark:bg-[#132847]/70 print:bg-[#F8FAFC] p-5">
          {snapshot.executiveSummaryMarkdown ? (
            <MarkdownRenderer content={snapshot.executiveSummaryMarkdown} />
          ) : (
            <div className="text-xs text-[#475569] dark:text-[#94A3B8] print:text-[#475569] leading-relaxed">
              Click <span className="font-semibold text-[#0B1F3A] dark:text-[#E0B44C]">Generate AI Executive Narrative</span> above to
              synthesize an executive board summary grounded in these live UK telecom metrics, or print this
              structured report directly to PDF.
            </div>
          )}
        </div>

        {/* Regional & Contract Tables */}
        <div className="print-break-inside-avoid grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC] print:text-[#0B1F3A] mb-2">
              UK Nation Exposure Breakdown
            </h3>
            <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#132847] print:bg-[#F8FAFC] border-b border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] text-[#475569] dark:text-[#94A3B8] print:text-[#475569]">
                  <tr>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">UK Nation</th>
                    <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Customers</th>
                    <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Churn %</th>
                    <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Monthly Rev at Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F] print:divide-[#F1F5F9]">
                  {charts.byNation.map((n) => (
                    <tr key={n.name}>
                      <td className="px-3 py-2 font-medium text-[#0F172A] dark:text-[#F8FAFC] print:text-[#0F172A] whitespace-nowrap">
                        {n.name}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC] print:text-[#0F172A]">
                        {formatNumber(n.customers)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC] print:text-[#0F172A]">
                        {formatPercent(n.churnRatePct)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-[#8B1E24] dark:text-[#C93842] print:text-[#8B1E24] tabular-nums">
                        {formatGBP(n.revRiskGBP)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC] print:text-[#0B1F3A] mb-2">
              Strategic Segment Priorities
            </h3>
            <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#132847] print:bg-[#F8FAFC] border-b border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] text-[#475569] dark:text-[#94A3B8] print:text-[#475569]">
                  <tr>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Segment</th>
                    <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Accounts</th>
                    <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Avg Risk</th>
                    <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">Monthly Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F] print:divide-[#F1F5F9]">
                  {snapshot.segments.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-medium text-[#0F172A] dark:text-[#F8FAFC] print:text-[#0F172A] whitespace-nowrap">
                        {s.name}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC] print:text-[#0F172A]">
                        {formatNumber(s.customerCount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC] print:text-[#0F172A]">
                        {formatPercent(s.avgChurnRiskPct)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-[#0B1F3A] dark:text-[#E0B44C] print:text-[#0B1F3A] tabular-nums">
                        {formatGBP(s.monthlyRevenueAtRiskGBP)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
