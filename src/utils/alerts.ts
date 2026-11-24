import type {
  AutomatedAlert,
  DataQualityReport,
  PlatformSettings,
  ScoredCustomerRecord,
} from '../types/britconnect';
import { formatGBPCompact, formatPercent, safeDivide } from './formatters';

export function isHighValueAccount(c: ScoredCustomerRecord, settings: PlatformSettings): boolean {
  return (
    c['Monthly Charge GBP'] >= settings.highValueMonthlyGBP ||
    c['Lifetime Revenue GBP'] >= settings.highValueLifetimeGBP
  );
}

export function isContractExpiringSoon(c: ScoredCustomerRecord, settings: PlatformSettings): boolean {
  return (
    c.Days_To_Contract_Expiry >= -15 &&
    c.Days_To_Contract_Expiry <= settings.contractExpiryWindowDays
  );
}

export function computeWatchlistAccounts(
  rows: ScoredCustomerRecord[],
  settings: PlatformSettings
): ScoredCustomerRecord[] {
  return rows
    .filter((c) => {
      const highVal = isHighValueAccount(c, settings);
      const isCritOrHigh = c.riskTier === 'Critical' || c.riskTier === 'High';
      const expiring = isContractExpiringSoon(c, settings);
      const competitor = c['Competitor Offer Received'] === 'Yes';
      return (highVal && isCritOrHigh) || (c.riskTier === 'Critical' && (expiring || competitor)) || (highVal && expiring && competitor);
    })
    .sort((a, b) => b.predictedMonthlyRevenueAtRisk - a.predictedMonthlyRevenueAtRisk);
}

export function computeAutomatedAlerts(
  rows: ScoredCustomerRecord[],
  qualityReport: DataQualityReport,
  settings: PlatformSettings
): AutomatedAlert[] {
  const alerts: AutomatedAlert[] = [];

  const hvExpiring = rows.filter(
    (c) => isHighValueAccount(c, settings) && isContractExpiringSoon(c, settings)
  );
  if (hvExpiring.length > 0) {
    const revSum = hvExpiring.reduce((s, r) => s + r['Monthly Charge GBP'], 0);
    alerts.push({
      id: 'alert-hv-expiring',
      severity: 'critical',
      title: `${hvExpiring.length} High-Value accounts expiring within ${settings.contractExpiryWindowDays} days`,
      description: `Accounts meeting >=£${settings.highValueMonthlyGBP}/mo or >=£${settings.highValueLifetimeGBP} LTV need proactive renewal lock-in (${formatGBPCompact(revSum)}/mo recurring value).`,
      metricBadge: `${hvExpiring.length} accounts`,
      targetView: 'watchlist',
      filterHint: 'expiring',
    });
  }

  const hvCritical = rows.filter(
    (c) => isHighValueAccount(c, settings) && c.riskTier === 'Critical'
  );
  if (hvCritical.length > 0) {
    alerts.push({
      id: 'alert-hv-critical',
      severity: 'critical',
      title: `${hvCritical.length} High-Value accounts flagged in Critical Risk (>=${settings.criticalThresholdPct}%)`,
      description: `Immediate retention specialist outreach recommended to protect ${formatGBPCompact(hvCritical.reduce((s, r) => s + r.predictedMonthlyRevenueAtRisk, 0))}/mo.`,
      metricBadge: `${hvCritical.length} critical`,
      targetView: 'watchlist',
      filterHint: 'critical',
    });
  }

  // Segment churn threshold check (> 25%)
  const segmentsMap = new Map<string, { total: number; churned: number }>();
  for (const r of rows) {
    const cur = segmentsMap.get(r['Customer Segment']) ?? { total: 0, churned: 0 };
    cur.total++;
    if (r['Churn Flag'] === 1) cur.churned++;
    segmentsMap.set(r['Customer Segment'], cur);
  }
  for (const [seg, v] of segmentsMap.entries()) {
    const rate = safeDivide(v.churned, v.total) * 100;
    if (rate >= 22) {
      alerts.push({
        id: `alert-seg-${seg}`,
        severity: 'warning',
        title: `${seg} observed churn rate at ${formatPercent(rate)}`,
        description: `Exceeds BritConnect target ceiling across ${v.total} accounts; inspect drivers in Executive Overview.`,
        metricBadge: formatPercent(rate),
        targetView: 'overview',
      });
    }
  }

  // Competitor offer + low CSAT
  const competitorVulnerable = rows.filter(
    (c) => c['Competitor Offer Received'] === 'Yes' && c['Satisfaction Score 1 10'] <= 5
  );
  if (competitorVulnerable.length > 0) {
    alerts.push({
      id: 'alert-comp-csat',
      severity: 'warning',
      title: `${competitorVulnerable.length} low-CSAT subscribers received a competitor offer`,
      description: 'High immediate switch propensity; prioritize service recovery + tariff match.',
      metricBadge: `${competitorVulnerable.length} flagged`,
      targetView: 'watchlist',
      filterHint: 'competitor',
    });
  }

  // Data upload quality alert
  const totalImputed = qualityReport.imputedNumericCount + qualityReport.imputedCategoricalCount;
  if (totalImputed > 0 || qualityReport.duplicatesRemoved > 0) {
    alerts.push({
      id: 'alert-data-quality',
      severity: 'info',
      title: `Last data pipeline run processed ${totalImputed} imputed value(s)`,
      description: `${qualityReport.duplicatesRemoved} duplicate(s) removed · ${qualityReport.rangeCorrectionsCount} range correction(s) · ${formatPercent(qualityReport.completenessPct)} schema completeness.`,
      metricBadge: `${totalImputed} imputed`,
      targetView: 'data-hub',
    });
  }

  return alerts;
}
