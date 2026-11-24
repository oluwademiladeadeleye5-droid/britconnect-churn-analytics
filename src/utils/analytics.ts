import type {
  DatasetSnapshot,
  GlobalFilters,
  ScoredCustomerRecord,
} from '../types/britconnect';
import { safeDivide } from './formatters';

export interface DashboardKPIs {
  totalCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  churnRatePct: number;
  monthlyRevenueAtRiskGBP: number;
  predictedMonthlyRevenueAtRiskGBP: number;
  totalLifetimeRevenueGBP: number;
  highCriticalRiskCount: number;
  avgSatisfaction: number;
  avgNps: number;
}

export function applyGlobalFilters(
  rows: ScoredCustomerRecord[],
  filters: GlobalFilters
): ScoredCustomerRecord[] {
  return rows.filter((r) => {
    if (filters.ukNation !== 'All' && r['UK Nation'] !== filters.ukNation) return false;
    if (filters.customerSegment !== 'All' && r['Customer Segment'] !== filters.customerSegment) return false;
    if (filters.serviceType !== 'All' && r['Service Type'] !== filters.serviceType) return false;
    if (filters.contractType !== 'All' && r['Contract Type'] !== filters.contractType) return false;
    if (filters.planName !== 'All' && r['Plan Name'] !== filters.planName) return false;
    if (filters.riskTier !== 'All' && r.riskTier !== filters.riskTier) return false;
    return true;
  });
}

export function computeDashboardKPIs(rows: ScoredCustomerRecord[]): DashboardKPIs {
  const totalCustomers = rows.length;
  if (totalCustomers === 0) {
    return {
      totalCustomers: 0,
      activeCustomers: 0,
      churnedCustomers: 0,
      churnRatePct: 0,
      monthlyRevenueAtRiskGBP: 0,
      predictedMonthlyRevenueAtRiskGBP: 0,
      totalLifetimeRevenueGBP: 0,
      highCriticalRiskCount: 0,
      avgSatisfaction: 0,
      avgNps: 0,
    };
  }

  let churnedCustomers = 0;
  let monthlyRevenueAtRiskGBP = 0;
  let predictedMonthlyRevenueAtRiskGBP = 0;
  let totalLifetimeRevenueGBP = 0;
  let highCriticalRiskCount = 0;
  let sumSat = 0;
  let sumNps = 0;

  for (const r of rows) {
    if (r['Churn Flag'] === 1) churnedCustomers++;
    monthlyRevenueAtRiskGBP += r['Monthly Revenue At Risk GBP'];
    predictedMonthlyRevenueAtRiskGBP += r.predictedMonthlyRevenueAtRisk;
    totalLifetimeRevenueGBP += r['Lifetime Revenue GBP'];
    if (r.riskTier === 'Critical' || r.riskTier === 'High') highCriticalRiskCount++;
    sumSat += r['Satisfaction Score 1 10'];
    sumNps += r['NPS Score'];
  }

  const activeCustomers = totalCustomers - churnedCustomers;

  return {
    totalCustomers,
    activeCustomers,
    churnedCustomers,
    churnRatePct: Number((safeDivide(churnedCustomers, totalCustomers) * 100).toFixed(1)),
    monthlyRevenueAtRiskGBP: Number(monthlyRevenueAtRiskGBP.toFixed(0)),
    predictedMonthlyRevenueAtRiskGBP: Number(predictedMonthlyRevenueAtRiskGBP.toFixed(0)),
    totalLifetimeRevenueGBP: Number(totalLifetimeRevenueGBP.toFixed(0)),
    highCriticalRiskCount,
    avgSatisfaction: Number(safeDivide(sumSat, totalCustomers).toFixed(1)),
    avgNps: Number(safeDivide(sumNps, totalCustomers).toFixed(1)),
  };
}

export function computeDashboardCharts(rows: ScoredCustomerRecord[]) {
  const totalRows = Math.max(1, rows.length);

  // 1. Contract Type Churn Rate & Volume
  const contractMap = new Map<string, { total: number; churned: number; revRisk: number }>();
  for (const r of rows) {
    const cur = contractMap.get(r['Contract Type']) ?? { total: 0, churned: 0, revRisk: 0 };
    cur.total++;
    if (r['Churn Flag'] === 1) cur.churned++;
    cur.revRisk += r.predictedMonthlyRevenueAtRisk;
    contractMap.set(r['Contract Type'], cur);
  }
  const byContract = Array.from(contractMap.entries()).map(([name, v]) => ({
    name,
    customers: v.total,
    sharePct: Number((safeDivide(v.total, totalRows) * 100).toFixed(1)),
    churnRatePct: Number((safeDivide(v.churned, v.total) * 100).toFixed(1)),
    revRiskGBP: Math.round(v.revRisk),
  }));

  // 2. Service Type Churn Rate & Volume
  const serviceMap = new Map<string, { total: number; churned: number; avgCharge: number; revRisk: number }>();
  for (const r of rows) {
    const cur = serviceMap.get(r['Service Type']) ?? { total: 0, churned: 0, avgCharge: 0, revRisk: 0 };
    cur.total++;
    if (r['Churn Flag'] === 1) cur.churned++;
    cur.avgCharge += r['Monthly Charge GBP'];
    cur.revRisk += r.predictedMonthlyRevenueAtRisk;
    serviceMap.set(r['Service Type'], cur);
  }
  const byService = Array.from(serviceMap.entries()).map(([name, v]) => ({
    name,
    customers: v.total,
    sharePct: Number((safeDivide(v.total, totalRows) * 100).toFixed(1)),
    churnRatePct: Number((safeDivide(v.churned, v.total) * 100).toFixed(1)),
    avgChargeGBP: Number(safeDivide(v.avgCharge, v.total).toFixed(2)),
    revRiskGBP: Math.round(v.revRisk),
  }));

  // 3. UK Nation & Top Cities Revenue at Risk
  const nationMap = new Map<string, { customers: number; churned: number; revRiskGBP: number }>();
  const cityMap = new Map<string, { nation: string; customers: number; revRiskGBP: number }>();
  for (const r of rows) {
    const nCur = nationMap.get(r['UK Nation']) ?? { customers: 0, churned: 0, revRiskGBP: 0 };
    nCur.customers++;
    if (r['Churn Flag'] === 1) nCur.churned++;
    nCur.revRiskGBP += r.predictedMonthlyRevenueAtRisk;
    nationMap.set(r['UK Nation'], nCur);

    const cCur = cityMap.get(r.City) ?? { nation: r['UK Nation'], customers: 0, revRiskGBP: 0 };
    cCur.customers++;
    cCur.revRiskGBP += r.predictedMonthlyRevenueAtRisk;
    cityMap.set(r.City, cCur);
  }
  const totalNationRisk = Math.max(
    1,
    Array.from(nationMap.values()).reduce((s, v) => s + v.revRiskGBP, 0)
  );
  const byNation = Array.from(nationMap.entries())
    .map(([name, v]) => ({
      name,
      customers: v.customers,
      sharePct: Number((safeDivide(v.revRiskGBP, totalNationRisk) * 100).toFixed(1)),
      churnRatePct: Number((safeDivide(v.churned, v.customers) * 100).toFixed(1)),
      revRiskGBP: Math.round(v.revRiskGBP),
    }))
    .sort((a, b) => b.revRiskGBP - a.revRiskGBP);

  const topCities = Array.from(cityMap.entries())
    .map(([city, v]) => ({
      city,
      nation: v.nation,
      customers: v.customers,
      revRiskGBP: Math.round(v.revRiskGBP),
    }))
    .sort((a, b) => b.revRiskGBP - a.revRiskGBP)
    .slice(0, 6);

  // 4. Risk Tier Composition & Probability Distribution
  const tierOrder: Array<'Critical' | 'High' | 'Medium' | 'Low'> = ['Critical', 'High', 'Medium', 'Low'];
  const riskTierComposition = tierOrder.map((tier) => {
    const items = rows.filter((r) => r.riskTier === tier);
    return {
      tier,
      count: items.length,
      sharePct: Number((safeDivide(items.length, rows.length) * 100).toFixed(1)),
      revRiskGBP: Math.round(items.reduce((s, r) => s + r.predictedMonthlyRevenueAtRisk, 0)),
    };
  });

  const probBuckets = [
    { label: '0–15%', min: 0, max: 0.15 },
    { label: '15–30%', min: 0.15, max: 0.3 },
    { label: '30–45%', min: 0.3, max: 0.45 },
    { label: '45–60%', min: 0.45, max: 0.6 },
    { label: '60–75%', min: 0.6, max: 0.75 },
    { label: '75–100%', min: 0.75, max: 1.01 },
  ];
  const probabilityHistogram = probBuckets.map((b) => {
    const items = rows.filter((r) => r.predictedProbability >= b.min && r.predictedProbability < b.max);
    return {
      bucket: b.label,
      customers: items.length,
      sharePct: Number((safeDivide(items.length, totalRows) * 100).toFixed(1)),
      revRiskGBP: Math.round(items.reduce((s, r) => s + r.predictedMonthlyRevenueAtRisk, 0)),
    };
  });

  // 5. Top Churn Reasons (for churned accounts)
  const reasonMap = new Map<string, { count: number; lostRevGBP: number }>();
  let totalChurnedReasonCount = 0;
  for (const r of rows) {
    if (r['Churn Flag'] !== 1) continue;
    totalChurnedReasonCount++;
    const reason = r['Churn Reason'] || 'Unspecified';
    const cur = reasonMap.get(reason) ?? { count: 0, lostRevGBP: 0 };
    cur.count++;
    cur.lostRevGBP += r['Monthly Charge GBP'];
    reasonMap.set(reason, cur);
  }
  const churnReasons = Array.from(reasonMap.entries())
    .map(([reason, v]) => ({
      reason,
      count: v.count,
      sharePct: Number((safeDivide(v.count, Math.max(1, totalChurnedReasonCount)) * 100).toFixed(1)),
      lostRevGBP: Math.round(v.lostRevGBP),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // 6. Tenure Cohort Churn Curve
  const tenureBuckets = [
    { label: '0–6m', min: 0, max: 6 },
    { label: '7–12m', min: 7, max: 12 },
    { label: '13–24m', min: 13, max: 24 },
    { label: '25–36m', min: 25, max: 36 },
    { label: '37–48m', min: 37, max: 48 },
    { label: '49m+', min: 49, max: 999 },
  ];
  const tenureCurve = tenureBuckets.map((tb) => {
    const members = rows.filter((r) => r['Tenure Months'] >= tb.min && r['Tenure Months'] <= tb.max);
    const churned = members.filter((r) => r['Churn Flag'] === 1).length;
    return {
      cohort: tb.label,
      customers: members.length,
      sharePct: Number((safeDivide(members.length, totalRows) * 100).toFixed(1)),
      churnRatePct: Number((safeDivide(churned, members.length) * 100).toFixed(1)),
      revRiskGBP: Math.round(members.reduce((s, r) => s + r.predictedMonthlyRevenueAtRisk, 0)),
    };
  });

  // 7. Monthly Churn & Revenue Loss Trend (from Churn Date)
  const monthMap = new Map<string, { churned: number; lostMonthlyRevGBP: number }>();
  for (const r of rows) {
    if (r['Churn Flag'] !== 1 || !r['Churn Date']) continue;
    const ym = r['Churn Date'].slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const cur = monthMap.get(ym) ?? { churned: 0, lostMonthlyRevGBP: 0 };
    cur.churned++;
    cur.lostMonthlyRevGBP += r['Monthly Charge GBP'];
    monthMap.set(ym, cur);
  }
  const monthlyTrendSlice = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);
  const totalTrendLost = Math.max(
    1,
    monthlyTrendSlice.reduce((s, [, v]) => s + v.lostMonthlyRevGBP, 0)
  );
  const monthlyTrend = monthlyTrendSlice.map(([ym, v]) => {
    const d = new Date(`${ym}-01T00:00:00Z`);
    const label = Number.isNaN(d.getTime())
      ? ym
      : new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(d);
    return {
      ym,
      month: label,
      churned: v.churned,
      sharePct: Number((safeDivide(v.lostMonthlyRevGBP, totalTrendLost) * 100).toFixed(1)),
      lostMonthlyRevGBP: Math.round(v.lostMonthlyRevGBP),
    };
  });

  return {
    byContract,
    byService,
    byNation,
    topCities,
    riskTierComposition,
    probabilityHistogram,
    churnReasons,
    tenureCurve,
    monthlyTrend,
  };
}

export function buildGroundedAIContext(snapshot: DatasetSnapshot) {
  const kpis = computeDashboardKPIs(snapshot.scoredRows);
  const charts = computeDashboardCharts(snapshot.scoredRows);
  const activeModel = snapshot.modelBundle.models[snapshot.modelBundle.championModelId];

  // Segment × UK Nation cross-tab for granular copilot questions
  const nationSegmentCross: Array<{
    ukNation: string;
    customerSegment: string;
    customers: number;
    churnRatePct: number;
    predictedMonthlyRevAtRiskGBP: number;
  }> = [];
  const crossMap = new Map<string, { n: string; s: string; count: number; churned: number; revRisk: number }>();
  for (const r of snapshot.scoredRows) {
    const key = `${r['UK Nation']}||${r['Customer Segment']}`;
    const cur = crossMap.get(key) ?? {
      n: r['UK Nation'],
      s: r['Customer Segment'],
      count: 0,
      churned: 0,
      revRisk: 0,
    };
    cur.count++;
    if (r['Churn Flag'] === 1) cur.churned++;
    cur.revRisk += r.predictedMonthlyRevenueAtRisk;
    crossMap.set(key, cur);
  }
  for (const v of crossMap.values()) {
    nationSegmentCross.push({
      ukNation: v.n,
      customerSegment: v.s,
      customers: v.count,
      churnRatePct: Number((safeDivide(v.churned, v.count) * 100).toFixed(1)),
      predictedMonthlyRevAtRiskGBP: Math.round(v.revRisk),
    });
  }

  // Contract × Service cross-tab
  const contractServiceMap = new Map<string, { contract: string; service: string; count: number; churned: number; avgCharge: number }>();
  for (const r of snapshot.scoredRows) {
    const key = `${r['Contract Type']}||${r['Service Type']}`;
    const cur = contractServiceMap.get(key) ?? {
      contract: r['Contract Type'],
      service: r['Service Type'],
      count: 0,
      churned: 0,
      avgCharge: 0,
    };
    cur.count++;
    if (r['Churn Flag'] === 1) cur.churned++;
    cur.avgCharge += r['Monthly Charge GBP'];
    contractServiceMap.set(key, cur);
  }
  const contractServiceCross = Array.from(contractServiceMap.values()).map((v) => ({
    contractType: v.contract,
    serviceType: v.service,
    customers: v.count,
    churnRatePct: Number((safeDivide(v.churned, v.count) * 100).toFixed(1)),
    avgMonthlyChargeGBP: Number(safeDivide(v.avgCharge, v.count).toFixed(2)),
  }));

  const top25HighRisk = [...snapshot.scoredRows]
    .sort((a, b) => b.predictedProbability - a.predictedProbability)
    .slice(0, 25)
    .map((r) => ({
      customerId: r['Customer ID'],
      segment: r['Customer Segment'],
      ukNation: r['UK Nation'],
      city: r.City,
      serviceType: r['Service Type'],
      planName: r['Plan Name'],
      contractType: r['Contract Type'],
      tenureMonths: r['Tenure Months'],
      monthlyChargeGBP: r['Monthly Charge GBP'],
      overageGBP: r['Overage Charges GBP'],
      complaints12M: r['Complaints 12M'],
      outages12M: r['Network Outages 12M'],
      satisfaction: r['Satisfaction Score 1 10'],
      competitorOffer: r['Competitor Offer Received'],
      predictedChurnProbPct: Number((r.predictedProbability * 100).toFixed(1)),
      riskTier: r.riskTier,
      topRiskDriver: r.topRiskDriver,
      predictedMonthlyRevAtRiskGBP: r.predictedMonthlyRevenueAtRisk,
    }));

  return {
    datasetName: snapshot.metadata.datasetName,
    portfolioKpis: kpis,
    byContract: charts.byContract,
    byService: charts.byService,
    byNation: charts.byNation,
    topCities: charts.topCities,
    nationSegmentCross,
    contractServiceCross,
    riskTierComposition: charts.riskTierComposition,
    topChurnReasons: charts.churnReasons,
    tenureCurve: charts.tenureCurve,
    championModel: {
      name: activeModel.name,
      rocAuc: activeModel.rocAuc,
      prAuc: activeModel.prAuc,
      precision: activeModel.precision,
      recall: activeModel.recall,
      f1Score: activeModel.f1Score,
      topDrivers: activeModel.featureImportance.slice(0, 8),
    },
    strategicSegments: snapshot.segments,
    campaigns: snapshot.campaigns.map((c) => ({
      name: c.name,
      targetSegment: c.targetSegment,
      status: c.status,
      retained: c.retained,
      contacted: c.contacted,
      costGBP: c.campaignCostGBP,
      revenueSavedGBP: c.revenueSavedGBP,
      roiPct: Number((safeDivide(c.revenueSavedGBP - c.campaignCostGBP, c.campaignCostGBP) * 100).toFixed(1)),
      churnLiftPct: Number((c.controlChurnPct - c.treatmentChurnPct).toFixed(1)),
    })),
    top25HighestRiskCustomers: top25HighRisk,
  };
}
