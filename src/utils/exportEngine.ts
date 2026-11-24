import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type {
  RetentionCampaign,
  RetentionPlaybook,
  ScoredCustomerRecord,
  StrategicSegment,
} from '../types/britconnect';
import { formatGBP, formatPercent } from './formatters';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildRiskRegisterRows(rows: ScoredCustomerRecord[]) {
  return rows.map((r) => ({
    'Customer ID': r['Customer ID'],
    'Customer Segment': r['Customer Segment'],
    'UK Nation': r['UK Nation'],
    City: r.City,
    'Service Type': r['Service Type'],
    'Plan Name': r['Plan Name'],
    'Contract Type': r['Contract Type'],
    'Tenure Months': r['Tenure Months'],
    'Monthly Charge GBP': r['Monthly Charge GBP'],
    'Overage Charges GBP': r['Overage Charges GBP'],
    'Discount Percent': r['Discount Percent'],
    'Auto Renew': r['Auto Renew'],
    'Direct Debit': r['Direct Debit'],
    'Support Tickets 12M': r['Support Tickets 12M'],
    'Complaints 12M': r['Complaints 12M'],
    'Network Outages 12M': r['Network Outages 12M'],
    'Satisfaction Score 1 10': r['Satisfaction Score 1 10'],
    'NPS Score': r['NPS Score'],
    'Competitor Offer Received': r['Competitor Offer Received'],
    'Churn Status': r['Churn Status'],
    'Churn Flag': r['Churn Flag'],
    'Lifetime Revenue GBP': r['Lifetime Revenue GBP'],
    Data_Utilization_Ratio: r.Data_Utilization_Ratio,
    Overage_Intensity: r.Overage_Intensity,
    Net_Monthly_Spend_GBP: r.Net_Monthly_Spend_GBP,
    Days_To_Contract_Expiry: r.Days_To_Contract_Expiry,
    Expiring_Within_60D: r.Expiring_Within_60D,
    Payment_Friction_Score: r.Payment_Friction_Score,
    Service_Friction_Index: r.Service_Friction_Index,
    Resolution_Burden_Hours: r.Resolution_Burden_Hours,
    Payment_Stability_Flag: r.Payment_Stability_Flag,
    ARPU_To_Lifetime_Ratio: r.ARPU_To_Lifetime_Ratio,
    NPS_Tier: r.NPS_Tier,
    'Predicted Churn Probability': Number((r.predictedProbability * 100).toFixed(2)),
    'Risk Tier': r.riskTier,
    'Predicted Monthly Revenue At Risk GBP': r.predictedMonthlyRevenueAtRisk,
    'Strategic Segment': r.strategicSegment,
    'Top Risk Driver': r.topRiskDriver,
  }));
}

export function exportRiskRegisterExcel(rows: ScoredCustomerRecord[], datasetName: string): void {
  const formatted = buildRiskRegisterRows(rows);
  const ws = XLSX.utils.json_to_sheet(formatted);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Risk Register');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const slug = datasetName.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  downloadBlob(blob, `britconnect_risk_register_${slug}.xlsx`);
}

export function exportRiskRegisterCSV(rows: ScoredCustomerRecord[], datasetName: string): void {
  const formatted = buildRiskRegisterRows(rows);
  const csv = Papa.unparse(formatted);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const slug = datasetName.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  downloadBlob(blob, `britconnect_risk_register_${slug}.csv`);
}

export function exportCampaignSegmentPackJSON(
  segments: StrategicSegment[],
  campaigns: RetentionCampaign[]
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    platform: 'BritConnect AI Customer Churn Intelligence Platform',
    strategicSegments: segments,
    retentionCampaigns: campaigns,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'britconnect_campaigns_and_segments.json');
}

export function exportCampaignPackCSV(campaigns: RetentionCampaign[]): void {
  const rows = campaigns.map((c) => ({
    'Campaign ID': c.id,
    'Campaign Name': c.name,
    'Target Segment': c.targetSegment,
    Channel: c.channel,
    'Offer Type': c.offerType,
    Status: c.status,
    'Start Date': c.startDate,
    'End Date': c.endDate,
    'Target Customers': c.targetCustomers,
    Contacted: c.contacted,
    Retained: c.retained,
    'Campaign Cost GBP': c.campaignCostGBP,
    'Revenue Saved GBP': c.revenueSavedGBP,
    'Net ROI Pct':
      c.campaignCostGBP > 0
        ? Number((((c.revenueSavedGBP - c.campaignCostGBP) / c.campaignCostGBP) * 100).toFixed(1))
        : 0,
    'Treatment Churn Pct': c.treatmentChurnPct,
    'Control Churn Pct': c.controlChurnPct,
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'britconnect_campaign_performance.csv');
}

export function exportPlaybooksMarkdown(playbooks: RetentionPlaybook[]): void {
  const lines: string[] = [
    '# BritConnect AI Retention Playbooks',
    `Exported: ${new Date().toLocaleString('en-GB')}`,
    '',
  ];

  for (const pb of playbooks) {
    lines.push(`## ${pb.title}`);
    lines.push(`- **Target:** ${pb.targetLabel} (${pb.targetType})`);
    lines.push(`- **Priority & Urgency:** ${pb.priorityTier} · ${pb.urgencyWindow}`);
    lines.push(`- **Recommended Channel:** ${pb.recommendedChannel}`);
    lines.push('');
    lines.push('### Evidence-Based Risk Diagnosis');
    lines.push(pb.evidenceDiagnosis);
    lines.push('');
    lines.push(`**Cited Telemetry:** ${pb.citedMetrics.join(' | ')}`);
    lines.push('');
    lines.push('### Recommended Offer & Messaging Angle');
    lines.push(`- **Offer:** ${pb.recommendedOffer}`);
    lines.push(`- **Messaging:** ${pb.messagingAngle}`);
    lines.push('');
    lines.push('### Implementation Plan');
    for (const step of pb.implementationSteps) {
      lines.push(
        `${step.stepNumber}. **${step.responsibleTeam}** (${step.channel}, ${step.timeline}): ${step.action}`
      );
    }
    lines.push('');
    lines.push('### Expected Business Impact');
    lines.push(
      `- Projected Churn Reduction: ${formatPercent(pb.expectedImpact.churnReductionPct)} | Retained Monthly Revenue: ${formatGBP(pb.expectedImpact.retainedMonthlyRevenueGBP)} | Retained Annual Revenue: ${formatGBP(pb.expectedImpact.retainedAnnualRevenueGBP)} | Est. Cost: ${formatGBP(pb.expectedImpact.estimatedInterventionCostGBP)} | Projected Net ROI: ${formatPercent(pb.expectedImpact.projectedNetRoiPct)}`
    );
    lines.push('');
    lines.push('### Measurable KPIs');
    for (const kpi of pb.measurableKpis) {
      lines.push(`- **${kpi.horizon} — ${kpi.metric}:** ${kpi.target}`);
    }
    lines.push('\n---\n');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
  downloadBlob(blob, 'britconnect_retention_playbooks.md');
}

export function exportChartDataCSV(
  rows: Array<Record<string, unknown>>,
  filenameSlug: string
): void {
  if (rows.length === 0) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const safeSlug = filenameSlug.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  downloadBlob(blob, `britconnect_${safeSlug}.csv`);
}

