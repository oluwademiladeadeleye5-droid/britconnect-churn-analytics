import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  BRITCONNECT_COLUMNS,
  LEAKAGE_EXCLUDED_COLUMNS,
  matchCanonicalColumn,
} from '../data/dataDictionary';
import type {
  CustomerCanonicalFields,
  DataQualityReport,
  EngineeredFeatures,
  NPSTier,
  SchemaMappingEntry,
} from '../types/britconnect';

export interface ParsedFileResult {
  fileName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function parseUploadedFile(file: File): Promise<ParsedFileResult> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The uploaded Excel workbook contains no sheets.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
    });
    if (jsonRows.length === 0) {
      throw new Error('The uploaded spreadsheet is empty.');
    }
    const headers = Object.keys(jsonRows[0]);
    return { fileName: file.name, headers, rows: jsonRows };
  }

  if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const arr: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
      ? parsed.data
      : Array.isArray(parsed?.customers)
      ? parsed.customers
      : [];
    if (arr.length === 0) {
      throw new Error('JSON file must contain a non-empty array of customer records.');
    }
    const headers = Array.from(new Set(arr.flatMap((r) => Object.keys(r || {}))));
    return { fileName: file.name, headers, rows: arr };
  }

  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = await file.text();
    const delimiter = lower.endsWith('.tsv') ? '\t' : undefined;
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      dynamicTyping: false,
    });
    if (result.errors.length > 0 && result.data.length === 0) {
      throw new Error(`Could not parse delimited file: ${result.errors[0].message}`);
    }
    if (result.data.length === 0) {
      throw new Error('The uploaded file contains no customer rows.');
    }
    const headers = result.meta.fields ?? Object.keys(result.data[0]);
    return { fileName: file.name, headers, rows: result.data };
  }

  throw new Error('Unsupported file format. Upload .xlsx, .xls, .csv, .json, or .tsv.');
}

export function buildAutoSchemaMapping(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): {
  mapping: Record<keyof CustomerCanonicalFields, string | null>;
  entries: SchemaMappingEntry[];
} {
  const mapping = {} as Record<keyof CustomerCanonicalFields, string | null>;
  const usedHeaders = new Set<string>();
  const entries: SchemaMappingEntry[] = [];

  for (const col of BRITCONNECT_COLUMNS) {
    let matchedHeader: string | null = null;
    let status: 'matched' | 'fuzzy' | 'missing' = 'missing';

    for (const h of headers) {
      if (usedHeaders.has(h)) continue;
      const match = matchCanonicalColumn(h);
      if (match.canonical === col.name) {
        matchedHeader = h;
        status = match.matchType === 'exact' ? 'matched' : 'fuzzy';
        usedHeaders.add(h);
        break;
      }
    }

    mapping[col.name] = matchedHeader;
    const firstNonEmpty =
      matchedHeader && sampleRows.length > 0
        ? sampleRows.find((r) => r[matchedHeader!] !== undefined && r[matchedHeader!] !== '')?.[matchedHeader!]
        : '';

    entries.push({
      canonicalColumn: col.name,
      matchedSourceColumn: matchedHeader,
      status,
      sampleValue: firstNonEmpty !== undefined && firstNonEmpty !== null ? String(firstNonEmpty).slice(0, 42) : '—',
      dataType: col.dataType,
    });
  }

  return { mapping, entries };
}

function parseNumericValue(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'na' || str.toLowerCase() === 'n/a') {
    return null;
  }
  const cleaned = str.replace(/[£$,%\s]/g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeBooleanYesNo(val: unknown, fallback: 'Yes' | 'No' = 'No'): 'Yes' | 'No' {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val >= 1 ? 'Yes' : 'No';
  const s = String(val).trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'on', 'active'].includes(s)) return 'Yes';
  if (['no', 'n', 'false', '0', 'off', 'inactive'].includes(s)) return 'No';
  return fallback;
}

function parseFlexibleDate(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number' && val > 20000 && val < 90000) {
    // Excel serial date
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (!str) return '';

  // DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str);
  if (ukMatch) {
    const day = Number(ukMatch[1]);
    const month = Number(ukMatch[2]);
    const year = Number(ukMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  const iso = new Date(str);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toISOString().slice(0, 10);
  }
  return '';
}

function computeMedian(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeMode(values: string[], fallback = 'Unknown'): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = fallback;
  let maxC = 0;
  for (const [k, c] of counts.entries()) {
    if (c > maxC) {
      maxC = c;
      best = k;
    }
  }
  return best;
}

export function cleanAndEngineerDataset(
  rawRows: Record<string, unknown>[],
  customMapping?: Record<keyof CustomerCanonicalFields, string | null>,
  options?: { missingValueStrategy?: 'impute' | 'drop'; contractExpiryWindowDays?: number }
): {
  cleanedRows: CustomerCanonicalFields[];
  engineeredRows: Array<CustomerCanonicalFields & EngineeredFeatures>;
  qualityReport: DataQualityReport;
} {
  const headers = rawRows.length > 0 ? Array.from(new Set(rawRows.flatMap((r) => Object.keys(r || {})))) : [];
  const auto = buildAutoSchemaMapping(headers, rawRows);
  const mapping = customMapping ?? auto.mapping;

  const schemaMapping: SchemaMappingEntry[] = BRITCONNECT_COLUMNS.map((col) => {
    const mapped = mapping[col.name] ?? null;
    const autoEntry = auto.entries.find((e) => e.canonicalColumn === col.name);
    const sampleVal =
      mapped && rawRows.length > 0
        ? rawRows.find((r) => r[mapped] !== undefined && r[mapped] !== '')?.[mapped]
        : '';
    return {
      canonicalColumn: col.name,
      matchedSourceColumn: mapped,
      status: !mapped ? 'missing' : autoEntry?.status === 'matched' && mapped === autoEntry.matchedSourceColumn ? 'matched' : 'fuzzy',
      sampleValue: sampleVal !== undefined && sampleVal !== null && sampleVal !== '' ? String(sampleVal).slice(0, 42) : '—',
      dataType: col.dataType,
    };
  });

  // 1. Deduplicate by Customer ID
  const seenIds = new Set<string>();
  const dedupedRaw: Record<string, unknown>[] = [];
  let duplicatesRemoved = 0;
  const idCol = mapping['Customer ID'];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rawId = idCol ? String(row[idCol] ?? '').trim() : '';
    const effectiveId = rawId || `BC-AUTO-${idx + 1}`;
    if (seenIds.has(effectiveId)) {
      duplicatesRemoved++;
      continue;
    }
    if (options?.missingValueStrategy === 'drop') {
      const requiredKeys: Array<keyof CustomerCanonicalFields> = [
        'Monthly Charge GBP',
        'Tenure Months',
        'Contract Type',
        'Satisfaction Score 1 10',
      ];
      const hasMissing = requiredKeys.some((k) => {
        const src = mapping[k];
        if (!src) return false;
        const v = row[src];
        return v === null || v === undefined || String(v).trim() === '';
      });
      if (hasMissing) {
        continue;
      }
    }
    seenIds.add(effectiveId);
    dedupedRaw.push({ ...row, __resolvedId: effectiveId });
  }

  // 2. Gather medians & modes for missing value imputation
  const numericFields: Array<keyof CustomerCanonicalFields> = [
    'Age',
    'Tenure Months',
    'Monthly Charge GBP',
    'Average Monthly Usage GB',
    'Data Allowance GB',
    'Overage Charges GBP',
    'Discount Percent',
    'Late Payments 12M',
    'Failed Payments 12M',
    'Support Tickets 12M',
    'Complaints 12M',
    'Average Resolution Hours',
    'Network Outages 12M',
    'Satisfaction Score 1 10',
    'NPS Score',
    'Lifetime Revenue GBP',
  ];

  const numericDefaults: Record<string, number> = {
    Age: 38,
    'Tenure Months': 18,
    'Monthly Charge GBP': 45,
    'Average Monthly Usage GB': 350,
    'Data Allowance GB': 500,
    'Overage Charges GBP': 0,
    'Discount Percent': 0,
    'Late Payments 12M': 0,
    'Failed Payments 12M': 0,
    'Support Tickets 12M': 1,
    'Complaints 12M': 0,
    'Average Resolution Hours': 12,
    'Network Outages 12M': 0,
    'Satisfaction Score 1 10': 7,
    'NPS Score': 10,
    'Lifetime Revenue GBP': 850,
  };

  const medians: Record<string, number> = {};
  for (const field of numericFields) {
    const srcCol = mapping[field];
    const nums: number[] = [];
    if (srcCol) {
      for (const r of dedupedRaw) {
        const parsed = parseNumericValue(r[srcCol]);
        if (parsed !== null) nums.push(parsed);
      }
    }
    medians[field] = computeMedian(nums, numericDefaults[field]);
  }

  const categoricalFields: Array<keyof CustomerCanonicalFields> = [
    'Customer Segment',
    'Age Band',
    'Gender',
    'UK Nation',
    'City',
    'Acquisition Channel',
    'Service Type',
    'Plan Name',
    'Contract Type',
    'Payment Method',
  ];
  const modes: Record<string, string> = {};
  for (const field of categoricalFields) {
    const srcCol = mapping[field];
    const vals: string[] = [];
    if (srcCol) {
      for (const r of dedupedRaw) {
        const v = String(r[srcCol] ?? '').trim();
        if (v) vals.push(v);
      }
    }
    modes[field] = computeMode(vals, field === 'UK Nation' ? 'England' : 'Unknown');
  }

  let imputedNumericCount = 0;
  let imputedCategoricalCount = 0;
  let rangeCorrectionsCount = 0;
  let nonEmptyCells = 0;
  const totalExpectedCells = dedupedRaw.length * BRITCONNECT_COLUMNS.length;

  const getRaw = (r: Record<string, unknown>, field: keyof CustomerCanonicalFields) => {
    const src = mapping[field];
    return src ? r[src] : undefined;
  };

  const readNum = (
    r: Record<string, unknown>,
    field: keyof CustomerCanonicalFields,
    min?: number,
    max?: number,
    roundInt = false
  ): number => {
    const raw = getRaw(r, field);
    let val = parseNumericValue(raw);
    if (val === null) {
      imputedNumericCount++;
      val = medians[field] ?? 0;
    } else {
      nonEmptyCells++;
    }
    if (min !== undefined && val < min) {
      val = min;
      rangeCorrectionsCount++;
    }
    if (max !== undefined && val > max) {
      val = max;
      rangeCorrectionsCount++;
    }
    return roundInt ? Math.round(val) : Number(val.toFixed(2));
  };

  const readCat = (r: Record<string, unknown>, field: keyof CustomerCanonicalFields): string => {
    const raw = getRaw(r, field);
    const s = raw !== undefined && raw !== null ? String(raw).trim() : '';
    if (!s) {
      imputedCategoricalCount++;
      return modes[field] || 'Unknown';
    }
    nonEmptyCells++;
    return s;
  };

  const cleanedRows: CustomerCanonicalFields[] = [];
  const warnings: string[] = [];

  for (const r of dedupedRaw) {
    const customerId = String(r.__resolvedId);
    if (getRaw(r, 'Customer ID')) nonEmptyCells++;

    const age = readNum(r, 'Age', 18, 110, true);
    let ageBand = String(getRaw(r, 'Age Band') ?? '').trim();
    if (!ageBand) {
      imputedCategoricalCount++;
      ageBand =
        age < 26 ? '18-25' : age < 36 ? '26-35' : age < 46 ? '36-45' : age < 56 ? '46-55' : age < 66 ? '56-65' : '65+';
    } else {
      nonEmptyCells++;
    }

    const tenureMonths = readNum(r, 'Tenure Months', 0, 240, true);
    const joinDateRaw = parseFlexibleDate(getRaw(r, 'Join Date'));
    if (joinDateRaw) nonEmptyCells++;
    const joinDate =
      joinDateRaw ||
      new Date(Date.UTC(2026, 10, 24) - tenureMonths * 30.4375 * 86400000).toISOString().slice(0, 10);

    const contractStartRaw = parseFlexibleDate(getRaw(r, 'Contract Start Date'));
    if (contractStartRaw) nonEmptyCells++;
    const contractStartDate = contractStartRaw || joinDate;

    const contractType = readCat(r, 'Contract Type');
    const contractEndRaw = parseFlexibleDate(getRaw(r, 'Contract End Date'));
    if (contractEndRaw) nonEmptyCells++;
    const contractEndDate =
      contractEndRaw ||
      new Date(
        new Date(contractStartDate).getTime() +
          (contractType.toLowerCase().includes('24') ? 730 : contractType.toLowerCase().includes('12') ? 365 : 30) *
            86400000
      )
        .toISOString()
        .slice(0, 10);

    const autoRenew = normalizeBooleanYesNo(getRaw(r, 'Auto Renew'), 'Yes');
    if (getRaw(r, 'Auto Renew') !== undefined && getRaw(r, 'Auto Renew') !== '') nonEmptyCells++;

    const directDebit = normalizeBooleanYesNo(getRaw(r, 'Direct Debit'), 'Yes');
    if (getRaw(r, 'Direct Debit') !== undefined && getRaw(r, 'Direct Debit') !== '') nonEmptyCells++;

    const competitorOffer = normalizeBooleanYesNo(getRaw(r, 'Competitor Offer Received'), 'No');
    if (getRaw(r, 'Competitor Offer Received') !== undefined && getRaw(r, 'Competitor Offer Received') !== '')
      nonEmptyCells++;

    const monthlyCharge = readNum(r, 'Monthly Charge GBP', 0, 2500);
    const avgUsage = readNum(r, 'Average Monthly Usage GB', 0, 50000);
    const allowance = readNum(r, 'Data Allowance GB', 1, 50000, true);
    const overage = readNum(r, 'Overage Charges GBP', 0, 2000);
    const discount = readNum(r, 'Discount Percent', 0, 100);
    const latePayments = readNum(r, 'Late Payments 12M', 0, 36, true);
    const failedPayments = readNum(r, 'Failed Payments 12M', 0, 36, true);
    const supportTickets = readNum(r, 'Support Tickets 12M', 0, 100, true);
    const complaints = readNum(r, 'Complaints 12M', 0, 50, true);
    const avgResolution = readNum(r, 'Average Resolution Hours', 0, 720);
    const networkOutages = readNum(r, 'Network Outages 12M', 0, 50, true);
    const satisfaction = readNum(r, 'Satisfaction Score 1 10', 1, 10, true);
    const nps = readNum(r, 'NPS Score', -100, 100, true);
    const lifetimeRev = readNum(r, 'Lifetime Revenue GBP', 0, 500000);

    // Reconcile Churn Flag & Churn Status
    const rawFlag = parseNumericValue(getRaw(r, 'Churn Flag'));
    const rawStatus = String(getRaw(r, 'Churn Status') ?? '').trim().toLowerCase();
    if (rawFlag !== null) nonEmptyCells++;
    if (rawStatus) nonEmptyCells++;

    let churnFlag: 0 | 1 = 0;
    if (rawFlag !== null) {
      churnFlag = rawFlag >= 1 ? 1 : 0;
    } else if (rawStatus) {
      churnFlag = rawStatus.includes('churn') || rawStatus === 'yes' || rawStatus === '1' ? 1 : 0;
    }

    const expectedStatus: 'Active' | 'Churned' = churnFlag === 1 ? 'Churned' : 'Active';
    if (rawStatus && ((churnFlag === 1 && rawStatus === 'active') || (churnFlag === 0 && rawStatus === 'churned'))) {
      rangeCorrectionsCount++;
    }

    // Preserve blanks for Active customers in Churn Date & Churn Reason
    const rawChurnDate = parseFlexibleDate(getRaw(r, 'Churn Date'));
    const rawChurnReason = String(getRaw(r, 'Churn Reason') ?? '').trim();
    if (rawChurnDate) nonEmptyCells++;
    if (rawChurnReason) nonEmptyCells++;

    const churnDate = churnFlag === 1 ? rawChurnDate : '';
    const churnReason = churnFlag === 1 ? rawChurnReason || 'Unspecified' : '';

    const rawRevRisk = parseNumericValue(getRaw(r, 'Monthly Revenue At Risk GBP'));
    if (rawRevRisk !== null) nonEmptyCells++;
    const monthlyRevAtRisk =
      rawRevRisk !== null && rawRevRisk >= 0
        ? Number(rawRevRisk.toFixed(2))
        : Number((churnFlag === 1 ? monthlyCharge + overage : (monthlyCharge + overage) * 0.25).toFixed(2));

    cleanedRows.push({
      'Customer ID': customerId,
      'Customer Segment': readCat(r, 'Customer Segment'),
      Age: age,
      'Age Band': ageBand,
      Gender: readCat(r, 'Gender'),
      'UK Nation': readCat(r, 'UK Nation'),
      City: readCat(r, 'City'),
      'Acquisition Channel': readCat(r, 'Acquisition Channel'),
      'Join Date': joinDate,
      'Tenure Months': tenureMonths,
      'Service Type': readCat(r, 'Service Type'),
      'Plan Name': readCat(r, 'Plan Name'),
      'Contract Type': contractType,
      'Contract Start Date': contractStartDate,
      'Contract End Date': contractEndDate,
      'Auto Renew': autoRenew,
      'Monthly Charge GBP': monthlyCharge,
      'Average Monthly Usage GB': avgUsage,
      'Data Allowance GB': allowance,
      'Overage Charges GBP': overage,
      'Discount Percent': discount,
      'Payment Method': readCat(r, 'Payment Method'),
      'Direct Debit': directDebit,
      'Late Payments 12M': latePayments,
      'Failed Payments 12M': failedPayments,
      'Support Tickets 12M': supportTickets,
      'Complaints 12M': complaints,
      'Average Resolution Hours': avgResolution,
      'Network Outages 12M': networkOutages,
      'Satisfaction Score 1 10': satisfaction,
      'NPS Score': nps,
      'Competitor Offer Received': competitorOffer,
      'Churn Status': expectedStatus,
      'Churn Date': churnDate,
      'Churn Reason': churnReason,
      'Lifetime Revenue GBP': lifetimeRev,
      'Monthly Revenue At Risk GBP': monthlyRevAtRisk,
      'Churn Flag': churnFlag,
    });
  }

  // Detect NPS scale (0-10 vs -100 to +100) across dataset
  const maxAbsNps = cleanedRows.reduce((m, r) => Math.max(m, Math.abs(r['NPS Score'])), 0);
  const minNps = cleanedRows.reduce((m, r) => Math.min(m, r['NPS Score']), 0);
  const isZeroToTenNps = minNps >= 0 && maxAbsNps <= 10;

  const expiryWindow = options?.contractExpiryWindowDays ?? 60;
  const refTime = Date.now();
  const engineeredRows = cleanedRows.map((row): CustomerCanonicalFields & EngineeredFeatures => {
    const endMs = new Date(row['Contract End Date']).getTime();
    const daysToExpiry = Number.isFinite(endMs) ? Math.round((endMs - refTime) / 86400000) : 90;

    let npsTier: NPSTier = 'Passive';
    if (isZeroToTenNps) {
      npsTier = row['NPS Score'] <= 6 ? 'Detractor' : row['NPS Score'] >= 9 ? 'Promoter' : 'Passive';
    } else {
      npsTier = row['NPS Score'] < 0 ? 'Detractor' : row['NPS Score'] >= 30 ? 'Promoter' : 'Passive';
    }

    const features: EngineeredFeatures = {
      Data_Utilization_Ratio: Number((row['Average Monthly Usage GB'] / Math.max(row['Data Allowance GB'], 1)).toFixed(3)),
      Overage_Intensity: Number((row['Overage Charges GBP'] / Math.max(row['Monthly Charge GBP'], 1)).toFixed(3)),
      Net_Monthly_Spend_GBP: Number(
        (row['Monthly Charge GBP'] * (1 - row['Discount Percent'] / 100) + row['Overage Charges GBP']).toFixed(2)
      ),
      Days_To_Contract_Expiry: daysToExpiry,
      Expiring_Within_60D: daysToExpiry >= -15 && daysToExpiry <= expiryWindow ? 1 : 0,
      Payment_Friction_Score: row['Late Payments 12M'] + 2 * row['Failed Payments 12M'],
      Service_Friction_Index: Number(
        (row['Support Tickets 12M'] + 2 * row['Complaints 12M'] + 1.5 * row['Network Outages 12M']).toFixed(1)
      ),
      Resolution_Burden_Hours: Number((row['Support Tickets 12M'] * row['Average Resolution Hours']).toFixed(1)),
      Payment_Stability_Flag: row['Auto Renew'] === 'Yes' && row['Direct Debit'] === 'Yes' ? 1 : 0,
      ARPU_To_Lifetime_Ratio: Number((row['Lifetime Revenue GBP'] / Math.max(row['Tenure Months'], 1)).toFixed(2)),
      NPS_Tier: npsTier,
    };

    return { ...row, ...features };
  });

  const missingSchemaCols = schemaMapping.filter((s) => s.status === 'missing').map((s) => s.canonicalColumn);
  if (missingSchemaCols.length > 0) {
    warnings.push(
      `${missingSchemaCols.length} canonical column(s) were not present and received clean defaults/imputations: ${missingSchemaCols.slice(0, 5).join(', ')}${missingSchemaCols.length > 5 ? '…' : ''}`
    );
  }
  if (duplicatesRemoved > 0) {
    warnings.push(`Removed ${duplicatesRemoved} duplicate Customer ID record(s).`);
  }
  if (rangeCorrectionsCount > 0) {
    warnings.push(`Sanitized ${rangeCorrectionsCount} out-of-range or inconsistent field value(s).`);
  }

  const completenessPct =
    totalExpectedCells > 0 ? Number(((nonEmptyCells / totalExpectedCells) * 100).toFixed(1)) : 100;

  return {
    cleanedRows,
    engineeredRows,
    qualityReport: {
      totalRawRows: rawRows.length,
      finalRowCount: cleanedRows.length,
      duplicatesRemoved,
      imputedNumericCount,
      imputedCategoricalCount,
      rangeCorrectionsCount,
      completenessPct: Math.min(100, completenessPct),
      warnings,
      leakageExcludedColumns: LEAKAGE_EXCLUDED_COLUMNS,
      targetColumn: 'Churn Flag',
      schemaMapping,
      processedAt: new Date().toISOString(),
    },
  };
}
