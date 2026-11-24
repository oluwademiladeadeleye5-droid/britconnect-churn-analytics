import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Table2,
  FileSpreadsheet,
  SlidersHorizontal,
} from 'lucide-react';
import { BRITCONNECT_COLUMNS } from '../data/dataDictionary';
import type {
  CustomerCanonicalFields,
  DataQualityReport,
  DatasetMetadata,
  PlatformSettings,
  ScoredCustomerRecord,
} from '../types/britconnect';
import { formatNumber, formatPercent, formatTimestamp } from '../utils/formatters';

interface DataHubViewProps {
  metadata: DatasetMetadata;
  rawRows: Record<string, unknown>[];
  cleanedRows: CustomerCanonicalFields[];
  scoredRows: ScoredCustomerRecord[];
  qualityReport: DataQualityReport;
  settings: PlatformSettings;
  onUploadFile: (file: File) => void;
  onLoadDemo: () => void;
  onResetData: () => void;
  onRemapSchema: (mapping: Record<keyof CustomerCanonicalFields, string | null>) => void;
  isProcessing: boolean;
}

type HubSectionTab = 'overview' | 'schema' | 'previews';
type PreviewTableTab = 'raw' | 'cleaned' | 'engineered';

export const DataHubView: React.FC<DataHubViewProps> = ({
  metadata,
  rawRows,
  cleanedRows,
  scoredRows,
  qualityReport,
  settings,
  onUploadFile,
  onLoadDemo,
  onResetData,
  onRemapSchema,
  isProcessing,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sectionTab, setSectionTab] = useState<HubSectionTab>('overview');
  const [previewTab, setPreviewTab] = useState<PreviewTableTab>('cleaned');

  const rawHeaders =
    rawRows.length > 0 ? Array.from(new Set(rawRows.flatMap((r) => Object.keys(r || {})))) : [];

  const [draftMapping, setDraftMapping] = useState<Record<keyof CustomerCanonicalFields, string | null>>(
    () => {
      const map = {} as Record<keyof CustomerCanonicalFields, string | null>;
      for (const s of qualityReport.schemaMapping) {
        map[s.canonicalColumn] = s.matchedSourceColumn;
      }
      return map;
    }
  );

  React.useEffect(() => {
    const map = {} as Record<keyof CustomerCanonicalFields, string | null>;
    for (const s of qualityReport.schemaMapping) {
      map[s.canonicalColumn] = s.matchedSourceColumn;
    }
    setDraftMapping(map);
  }, [qualityReport]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUploadFile(file);
  };

  const matchedCount = qualityReport.schemaMapping.filter((s) => s.status !== 'missing').length;
  const rowPad = settings.tableDensity === 'compact' ? 'py-1.5' : 'py-2.5';

  return (
    <div className="space-y-5">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] pb-3">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <div className="inline-flex rounded-lg bg-[#E2E8F0]/60 dark:bg-[#132847] p-1 gap-1">
            {(
              [
                { id: 'overview', label: 'Overview & Upload', icon: FileSpreadsheet },
                { id: 'schema', label: `Schema Mapping (${matchedCount}/38)`, icon: SlidersHorizontal },
                { id: 'previews', label: 'Data Previews', icon: Table2 },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = sectionTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSectionTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
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
          Missing Strategy: {settings.missingValueStrategy === 'drop' ? 'Drop incomplete' : 'Auto-impute'} ·{' '}
          {formatNumber(metadata.rowCount)} rows persisted
        </div>
      </div>

      {/* TAB 1: OVERVIEW & UPLOAD */}
      {sectionTab === 'overview' && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`lg:col-span-8 rounded-2xl border-2 border-dashed p-6 transition-colors bg-white dark:bg-[#0D1E36] ${
                isDragging
                  ? 'border-[#C89B3C] dark:border-[#E0B44C] bg-[#FFFBEB]/40 dark:bg-[#132847]'
                  : 'border-[#CBD5E1] dark:border-[#1E3A5F] hover:border-[#0B1F3A] dark:hover:border-[#E0B44C]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUploadFile(file);
                    e.target.value = '';
                  }
                }}
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] dark:bg-[#132847] text-[#D4AF37] dark:text-[#E0B44C]">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                      Ingest Customer Churn Dataset
                    </h2>
                    <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed max-w-xl">
                      Drag and drop Excel (<span className="font-mono">.xlsx</span>,{' '}
                      <span className="font-mono">.xls</span>), CSV, TSV, or JSON files. Uploaded datasets
                      automatically clean, engineer 10 telecom features, retrain both ML models, and persist in
                      IndexedDB across refreshes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  <span>{isProcessing ? 'Processing...' : 'Select File'}</span>
                </button>
              </div>
            </div>

            {/* Active Dataset & Demo Controls */}
            <div className="lg:col-span-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                  Active Persisted Dataset
                </div>
                <div className="mt-1 font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC] truncate">
                  {metadata.datasetName}
                </div>
                <div className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                  {formatNumber(metadata.rowCount)} cleaned rows · Saved {formatTimestamp(metadata.lastSavedAt)}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={onLoadDemo}
                  className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#C89B3C] dark:bg-[#E0B44C] px-3 text-xs font-semibold text-[#0B1F3A] hover:bg-[#D4AF37] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
                >
                  Load BritConnect Demo (600)
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={onResetData}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#8B1E24] dark:text-[#C93842] hover:bg-[#FEF2F2] dark:hover:bg-[#8B1E24]/20 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </section>

          {isProcessing ? (
            <div aria-busy="true" aria-label="Ingesting dataset and training ML models" className="space-y-6">
              <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 animate-pulse"
                  >
                    <div className="h-3 w-20 rounded bg-[#E2E8F0] dark:bg-[#132847]" />
                    <div className="mt-3 h-6 w-16 rounded bg-[#CBD5E1] dark:bg-[#1E3A5F]" />
                    <div className="mt-2 h-2.5 w-24 rounded bg-[#F1F5F9] dark:bg-[#132847]" />
                  </div>
                ))}
              </section>
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 animate-pulse space-y-2.5">
                  <div className="h-3.5 w-44 rounded bg-[#E2E8F0] dark:bg-[#132847]" />
                  <div className="h-3 w-full rounded bg-[#F1F5F9] dark:bg-[#1E3A5F]/60" />
                  <div className="h-3 w-4/5 rounded bg-[#F1F5F9] dark:bg-[#1E3A5F]/60" />
                </div>
                <div className="lg:col-span-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-5 animate-pulse space-y-2.5">
                  <div className="h-3.5 w-44 rounded bg-[#E2E8F0] dark:bg-[#132847]" />
                  <div className="h-3 w-full rounded bg-[#F1F5F9] dark:bg-[#1E3A5F]/60" />
                  <div className="h-3 w-3/4 rounded bg-[#F1F5F9] dark:bg-[#1E3A5F]/60" />
                </div>
              </section>
            </div>
          ) : (
            <>
              {/* Data Quality Scorecard */}
              <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  {
                    label: 'Completeness',
                    value: formatPercent(qualityReport.completenessPct),
                    sub: 'Across 38 schema fields',
                  },
                  {
                    label: 'Schema Matched',
                    value: `${matchedCount} / 38`,
                    sub: 'Auto-mapped columns',
                  },
                  {
                    label: 'Valid Records',
                    value: formatNumber(qualityReport.finalRowCount),
                    sub: `From ${formatNumber(qualityReport.totalRawRows)} raw`,
                  },
                  {
                    label: 'Duplicates Removed',
                    value: formatNumber(qualityReport.duplicatesRemoved),
                    sub: 'By Customer ID',
                  },
                  {
                    label: 'Values Imputed',
                    value: formatNumber(
                      qualityReport.imputedNumericCount + qualityReport.imputedCategoricalCount
                    ),
                    sub: `${qualityReport.imputedNumericCount} num · ${qualityReport.imputedCategoricalCount} cat`,
                  },
                  {
                    label: 'Range Corrections',
                    value: formatNumber(qualityReport.rangeCorrectionsCount),
                    sub: 'Sanitized bounds',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 shadow-xs"
                  >
                    <div className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">{item.label}</div>
                    <div className="mt-2 font-display text-xl font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                      {item.value}
                    </div>
                    <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">{item.sub}</div>
                  </div>
                ))}
              </section>

              {/* Leakage Audit & Pipeline Warnings */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1F3A] dark:text-[#F8FAFC]">
                    <ShieldCheck className="h-4 w-4 text-[#C89B3C] dark:text-[#E0B44C]" />
                    <span>Target Leakage Prevention Audit</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    Model target is strictly{' '}
                    <span className="font-mono font-semibold text-[#0B1F3A] dark:text-[#E0B44C]">
                      Churn Flag
                    </span>{' '}
                    (0/1). Post-outcome and identifier columns are excluded from all training and scoring inputs:{' '}
                    <span className="font-mono text-[11px] text-[#0F172A] dark:text-[#CBD5E1]">
                      {qualityReport.leakageExcludedColumns.join(', ')}
                    </span>
                  </p>
                </div>

                <div className="lg:col-span-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1F3A] dark:text-[#F8FAFC]">
                    {qualityReport.warnings.length > 0 ? (
                      <AlertCircle className="h-4 w-4 text-[#C89B3C] dark:text-[#E0B44C]" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    )}
                    <span>Validation & Cleaning Log</span>
                  </div>
                  {qualityReport.warnings.length === 0 ? (
                    <p className="mt-1.5 text-xs text-[#475569] dark:text-[#94A3B8]">
                      Zero structural anomalies detected. All 38 BritConnect schema columns validated cleanly.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-1 text-xs text-[#475569] dark:text-[#94A3B8] list-disc pl-4">
                      {qualityReport.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* TAB 2: 38-COLUMN SCHEMA MAPPING */}
      {sectionTab === 'schema' && (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] overflow-hidden shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-3.5 bg-[#F8FAFC] dark:bg-[#132847]">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                38-Column BritConnect Data Dictionary Mapping
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Adjust column assignments manually if your source file uses non-standard field headers
              </p>
            </div>
            {rawHeaders.length > 0 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onRemapSchema(draftMapping)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] px-3.5 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Apply Mapping & Retrain</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold w-10">#</th>
                  <th className="px-4 py-2.5 font-semibold">BritConnect Canonical Column</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Mapped Source Column</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Sample Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                {BRITCONNECT_COLUMNS.map((col) => {
                  const entry = qualityReport.schemaMapping.find((s) => s.canonicalColumn === col.name);
                  const currentMapped = draftMapping[col.name] ?? '';
                  return (
                    <tr
                      key={col.name}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60 transition-colors"
                    >
                      <td className={`px-4 ${rowPad} font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums`}>
                        {col.no}
                      </td>
                      <td className={`px-4 ${rowPad}`}>
                        <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{col.name}</div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {col.description}
                        </div>
                      </td>
                      <td
                        className={`px-4 ${rowPad} font-mono text-[11px] text-[#475569] dark:text-[#94A3B8] whitespace-nowrap`}
                      >
                        {col.dataType}
                      </td>
                      <td className={`px-4 ${rowPad}`}>
                        <select
                          value={currentMapped}
                          onChange={(e) =>
                            setDraftMapping((prev) => ({
                              ...prev,
                              [col.name]: e.target.value || null,
                            }))
                          }
                          className="h-8 w-52 rounded-md border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:border-[#0B1F3A] dark:focus:border-[#E0B44C] focus:outline-none"
                        >
                          <option value="">— Not mapped (Auto-impute) —</option>
                          {rawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`px-4 ${rowPad} whitespace-nowrap`}>
                        <span
                          className={`text-xs font-medium ${
                            entry?.status === 'matched'
                              ? 'text-[#16325C] dark:text-[#4B7BEC]'
                              : entry?.status === 'fuzzy'
                              ? 'text-[#B4821E] dark:text-[#E0B44C]'
                              : 'text-[#8B1E24] dark:text-[#C93842]'
                          }`}
                        >
                          {entry?.status === 'matched'
                            ? 'Exact Match'
                            : entry?.status === 'fuzzy'
                            ? 'Auto-Mapped'
                            : 'Defaulted'}
                        </span>
                      </td>
                      <td
                        className={`px-4 ${rowPad} font-mono text-[11px] text-[#475569] dark:text-[#94A3B8] max-w-[180px] truncate`}
                      >
                        {entry?.sampleValue ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: DATA PREVIEWS (RAW / CLEANED / ENGINEERED) */}
      {sectionTab === 'previews' && (
        <section className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] overflow-hidden shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 sm:px-5 py-3.5 bg-[#F8FAFC] dark:bg-[#132847]">
            <div className="max-w-full overflow-x-auto no-scrollbar">
              <div className="inline-flex rounded-lg bg-[#E2E8F0]/60 dark:bg-[#0B1F3A] p-1 gap-1">
                {(
                  [
                    { id: 'raw', label: `Raw Upload (${Math.min(80, rawRows.length)})` },
                    { id: 'cleaned', label: `Cleaned Schema (${Math.min(80, cleanedRows.length)})` },
                    { id: 'engineered', label: `10 Engineered Features (${Math.min(80, scoredRows.length)})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewTab(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                      previewTab === tab.id
                        ? 'bg-white dark:bg-[#132847] text-[#0B1F3A] dark:text-[#E0B44C] shadow-xs'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Preview capped at first 80 rows for fluid browser rendering
            </span>
          </div>

          {previewTab === 'raw' && (
            <div className="overflow-x-auto max-h-[580px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                  <tr>
                    {rawHeaders.slice(0, 14).map((h) => (
                      <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                  {rawRows.slice(0, 80).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60">
                      {rawHeaders.slice(0, 14).map((h) => (
                        <td
                          key={h}
                          className={`px-3 ${rowPad} font-mono text-[11px] text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap tabular-nums`}
                        >
                          {String(row[h] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewTab === 'cleaned' && (
            <div className="overflow-x-auto max-h-[580px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                  <tr>
                    {[
                      'Customer ID',
                      'UK Nation',
                      'City',
                      'Customer Segment',
                      'Service Type',
                      'Contract Type',
                      'Tenure Months',
                      'Monthly Charge GBP',
                      'Overage Charges GBP',
                      'Complaints 12M',
                      'Satisfaction Score 1 10',
                      'Churn Status',
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 font-semibold whitespace-nowrap ${
                          i === 0 ? 'sticky left-0 z-10 bg-[#F8FAFC] dark:bg-[#132847]' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                  {cleanedRows.slice(0, 80).map((row) => (
                    <tr key={row['Customer ID']} className="hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60">
                      <td
                        className={`sticky left-0 z-10 bg-white dark:bg-[#0D1E36] px-3 ${rowPad} font-mono text-[11px] font-medium text-[#0B1F3A] dark:text-[#E0B44C] whitespace-nowrap`}
                      >
                        {row['Customer ID']}
                      </td>
                      <td className={`px-3 ${rowPad} whitespace-nowrap text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row['UK Nation']}
                      </td>
                      <td className={`px-3 ${rowPad} whitespace-nowrap text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.City}
                      </td>
                      <td className={`px-3 ${rowPad} whitespace-nowrap text-[#475569] dark:text-[#CBD5E1]`}>
                        {row['Customer Segment']}
                      </td>
                      <td className={`px-3 ${rowPad} whitespace-nowrap text-[#475569] dark:text-[#CBD5E1]`}>
                        {row['Service Type']}
                      </td>
                      <td className={`px-3 ${rowPad} whitespace-nowrap text-[#475569] dark:text-[#CBD5E1]`}>
                        {row['Contract Type']}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row['Tenure Months']}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        £{row['Monthly Charge GBP'].toFixed(2)}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        £{row['Overage Charges GBP'].toFixed(2)}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row['Complaints 12M']}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row['Satisfaction Score 1 10']}
                      </td>
                      <td
                        className={`px-3 ${rowPad} font-medium whitespace-nowrap ${
                          row['Churn Flag'] === 1
                            ? 'text-[#8B1E24] dark:text-[#C93842]'
                            : 'text-[#16325C] dark:text-[#4B7BEC]'
                        }`}
                      >
                        {row['Churn Status']}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewTab === 'engineered' && (
            <div className="overflow-x-auto max-h-[580px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#132847] border-b border-[#E2E8F0] dark:border-[#1E3A5F] text-[#475569] dark:text-[#94A3B8]">
                  <tr>
                    {[
                      'Customer ID',
                      'Data_Utilization_Ratio',
                      'Overage_Intensity',
                      'Net_Monthly_Spend_GBP',
                      'Days_To_Contract_Expiry',
                      'Expiring_Within_60D',
                      'Payment_Friction_Score',
                      'Service_Friction_Index',
                      'Resolution_Burden_Hours',
                      'Payment_Stability_Flag',
                      'ARPU_To_Lifetime_Ratio',
                      'NPS_Tier',
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 font-semibold whitespace-nowrap font-mono text-[11px] ${
                          i === 0 ? 'sticky left-0 z-10 bg-[#F8FAFC] dark:bg-[#132847]' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F]">
                  {scoredRows.slice(0, 80).map((row) => (
                    <tr key={row['Customer ID']} className="hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60">
                      <td
                        className={`sticky left-0 z-10 bg-white dark:bg-[#0D1E36] px-3 ${rowPad} font-mono text-[11px] font-medium text-[#0B1F3A] dark:text-[#E0B44C] whitespace-nowrap`}
                      >
                        {row['Customer ID']}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Data_Utilization_Ratio.toFixed(2)}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Overage_Intensity.toFixed(2)}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        £{row.Net_Monthly_Spend_GBP.toFixed(2)}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Days_To_Contract_Expiry}d
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Expiring_Within_60D}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Payment_Friction_Score}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Service_Friction_Index}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Resolution_Burden_Hours}h
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.Payment_Stability_Flag}
                      </td>
                      <td className={`px-3 ${rowPad} font-mono tabular-nums text-[#0F172A] dark:text-[#F8FAFC]`}>
                        £{row.ARPU_To_Lifetime_Ratio.toFixed(2)}
                      </td>
                      <td className={`px-3 ${rowPad} font-medium whitespace-nowrap text-[#0F172A] dark:text-[#F8FAFC]`}>
                        {row.NPS_Tier}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
