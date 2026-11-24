import type { CustomerCanonicalFields, RetentionCampaign } from '../types/britconnect';

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rng: () => number, items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((acc, i) => acc + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const REFERENCE_DATE = new Date('2026-11-24T00:00:00Z');

const NATION_CITIES: Record<string, Array<{ value: string; weight: number }>> = {
  England: [
    { value: 'London', weight: 32 },
    { value: 'Manchester', weight: 16 },
    { value: 'Birmingham', weight: 15 },
    { value: 'Leeds', weight: 12 },
    { value: 'Bristol', weight: 10 },
    { value: 'Liverpool', weight: 8 },
    { value: 'Newcastle', weight: 7 },
  ],
  Scotland: [
    { value: 'Edinburgh', weight: 36 },
    { value: 'Glasgow', weight: 40 },
    { value: 'Aberdeen', weight: 14 },
    { value: 'Dundee', weight: 10 },
  ],
  Wales: [
    { value: 'Cardiff', weight: 48 },
    { value: 'Swansea', weight: 30 },
    { value: 'Newport', weight: 22 },
  ],
  'Northern Ireland': [
    { value: 'Belfast', weight: 62 },
    { value: 'Derry', weight: 22 },
    { value: 'Lisburn', weight: 16 },
  ],
};

const PLANS_BY_SERVICE: Record<
  string,
  Array<{ name: string; charge: number; allowanceGb: number; segmentBias?: string }>
> = {
  'Fibre Broadband': [
    { name: 'Essential Fibre 150', charge: 29.99, allowanceGb: 500 },
    { name: 'Superfast Fibre 500', charge: 42.5, allowanceGb: 1500 },
    { name: 'Gigabit Fibre 1000', charge: 56.0, allowanceGb: 3000 },
  ],
  'Mobile 5G': [
    { name: 'SIM-Only 50GB', charge: 19.5, allowanceGb: 50 },
    { name: '5G Smart 150GB', charge: 31.0, allowanceGb: 150 },
    { name: '5G Unlimited Max', charge: 44.0, allowanceGb: 500 },
  ],
  'Converged Bundle': [
    { name: 'Home Fibre + 5G Duo', charge: 64.0, allowanceGb: 1800 },
    { name: 'TV, Fibre 500 & Mobile', charge: 82.5, allowanceGb: 2500 },
    { name: 'BritConnect Family Ultimate', charge: 98.0, allowanceGb: 4000 },
  ],
  'Business Connect': [
    { name: 'SME Fibre & VoIP', charge: 78.0, allowanceGb: 2500, segmentBias: 'Small Business' },
    { name: 'Enterprise 5G Fleet', charge: 112.0, allowanceGb: 3500, segmentBias: 'Small Business' },
    { name: 'Dedicated Leased Line', charge: 145.0, allowanceGb: 5000, segmentBias: 'Small Business' },
  ],
};

const CHURN_REASONS = [
  { value: 'Competitor Price Offer', weight: 30 },
  { value: 'Repeated Service Outages', weight: 22 },
  { value: 'Poor Support Resolution', weight: 18 },
  { value: 'Unexpected Overage Charges', weight: 15 },
  { value: 'Contract Expiry Switch', weight: 10 },
  { value: 'Relocation / Service Unavailable', weight: 5 },
];

export function generateBritConnectDemoDataset(count = 600): CustomerCanonicalFields[] {
  const rng = createRng(20261124);
  const rows: CustomerCanonicalFields[] = [];

  for (let i = 1; i <= count; i++) {
    const customerId = `BC-${String(10000 + i)}`;
    const customerSegment = pickWeighted(rng, [
      { value: 'Consumer', weight: 74 },
      { value: 'Small Business', weight: 26 },
    ]);

    const age = Math.round(clamp(19 + (rng() + rng()) * 31, 18, 84));
    const ageBand =
      age < 26 ? '18-25' : age < 36 ? '26-35' : age < 46 ? '36-45' : age < 56 ? '46-55' : age < 66 ? '56-65' : '65+';

    const gender = pickWeighted(rng, [
      { value: 'Female', weight: 48 },
      { value: 'Male', weight: 49 },
      { value: 'Non-Binary / Prefer not to say', weight: 3 },
    ]);

    const ukNation = pickWeighted(rng, [
      { value: 'England', weight: 68 },
      { value: 'Scotland', weight: 14 },
      { value: 'Wales', weight: 10 },
      { value: 'Northern Ireland', weight: 8 },
    ]);
    const city = pickWeighted(rng, NATION_CITIES[ukNation]);

    const acquisitionChannel = pickWeighted(rng, [
      { value: 'Digital Direct', weight: 34 },
      { value: 'Price Comparison Site', weight: 26 },
      { value: 'Retail Store', weight: 16 },
      { value: 'Telesales', weight: 12 },
      { value: 'Partner Referral', weight: 12 },
    ]);

    const serviceType =
      customerSegment === 'Small Business'
        ? pickWeighted(rng, [
            { value: 'Business Connect', weight: 58 },
            { value: 'Fibre Broadband', weight: 24 },
            { value: 'Mobile 5G', weight: 18 },
          ])
        : pickWeighted(rng, [
            { value: 'Fibre Broadband', weight: 40 },
            { value: 'Mobile 5G', weight: 34 },
            { value: 'Converged Bundle', weight: 26 },
          ]);

    const planChoices = PLANS_BY_SERVICE[serviceType];
    const plan = planChoices[Math.floor(rng() * planChoices.length)];

    const tenureMonths = Math.round(clamp(Math.pow(rng(), 1.2) * 72 + 1, 1, 78));
    const joinDate = addMonths(REFERENCE_DATE, -tenureMonths);

    const contractType = pickWeighted(rng, [
      { value: 'Month-to-Month', weight: tenureMonths < 8 ? 44 : 28 },
      { value: '12-Month', weight: 36 },
      { value: '24-Month', weight: tenureMonths > 18 ? 42 : 24 },
    ]);

    const contractTermMonths = contractType === 'Month-to-Month' ? 1 : contractType === '12-Month' ? 12 : 24;
    const monthsIntoContract = Math.floor(rng() * contractTermMonths);
    const contractStartDate = addMonths(REFERENCE_DATE, -Math.min(monthsIntoContract, tenureMonths));
    const contractEndDate =
      contractType === 'Month-to-Month'
        ? addDays(REFERENCE_DATE, Math.round(5 + rng() * 25))
        : addMonths(contractStartDate, contractTermMonths);

    const autoRenew: 'Yes' | 'No' = rng() < (contractType === 'Month-to-Month' ? 0.54 : 0.78) ? 'Yes' : 'No';
    const paymentMethod = pickWeighted(rng, [
      { value: 'Direct Debit', weight: 68 },
      { value: 'Debit / Credit Card', weight: 21 },
      { value: 'Bank Transfer / Invoice', weight: 11 },
    ]);
    const directDebit: 'Yes' | 'No' = paymentMethod === 'Direct Debit' ? 'Yes' : rng() < 0.12 ? 'Yes' : 'No';

    const monthlyChargeGBP = Number((plan.charge * (0.94 + rng() * 0.12)).toFixed(2));
    const discountPercent = rng() < 0.35 ? Number((5 + Math.floor(rng() * 4) * 5).toFixed(1)) : 0;

    const usageMultiplier = 0.28 + rng() * 0.98;
    const averageMonthlyUsageGB = Number((plan.allowanceGb * usageMultiplier).toFixed(1));
    const excessGb = Math.max(0, averageMonthlyUsageGB - plan.allowanceGb);
    const overageChargesGBP =
      excessGb > 0 ? Number((2.5 + (excessGb / Math.max(plan.allowanceGb, 50)) * 28 + rng() * 8).toFixed(2)) : rng() < 0.08 ? Number((3 + rng() * 9).toFixed(2)) : 0;

    const latePayments12M = rng() < 0.22 ? Math.floor(1 + rng() * 3) : 0;
    const failedPayments12M = latePayments12M > 0 && rng() < 0.45 ? Math.floor(1 + rng() * 2) : rng() < 0.05 ? 1 : 0;

    const networkOutages12M =
      ukNation === 'Wales' || ukNation === 'Northern Ireland'
        ? rng() < 0.42
          ? Math.floor(1 + rng() * 4)
          : 0
        : rng() < 0.26
        ? Math.floor(1 + rng() * 3)
        : 0;

    const supportTickets12M = Math.min(9, Math.floor(networkOutages12M * 0.8 + (overageChargesGBP > 8 ? 1.2 : 0) + rng() * 2.8));
    const complaints12M = supportTickets12M >= 2 && rng() < 0.48 ? Math.floor(1 + rng() * Math.min(3, supportTickets12M)) : 0;
    const averageResolutionHours = Number(
      clamp(4 + supportTickets12M * 4.5 + complaints12M * 9.5 + rng() * 14, 1.5, 76).toFixed(1)
    );

    const satisfactionBase =
      8.5 -
      complaints12M * 1.35 -
      networkOutages12M * 0.65 -
      (overageChargesGBP > 10 ? 1.1 : 0) -
      failedPayments12M * 0.7 +
      (tenureMonths > 24 ? 0.6 : 0);
    const satisfactionScore = Math.round(clamp(satisfactionBase + (rng() - 0.5) * 2.2, 1, 10));

    const npsScore = Math.round(clamp((satisfactionScore - 5.5) * 18 + (rng() - 0.5) * 24, -100, 100));

    const daysToExpiry = Math.round((contractEndDate.getTime() - REFERENCE_DATE.getTime()) / 86400000);
    const competitorOfferProb =
      0.16 +
      (contractType === 'Month-to-Month' ? 0.2 : 0) +
      (daysToExpiry <= 60 ? 0.18 : 0) +
      (satisfactionScore <= 5 ? 0.16 : 0);
    const competitorOfferReceived: 'Yes' | 'No' = rng() < competitorOfferProb ? 'Yes' : 'No';

    // True latent churn propensity (realistic, recoverable by Logistic Regression & GBDT)
    const netSpend = monthlyChargeGBP * (1 - discountPercent / 100) + overageChargesGBP;
    const logit =
      -2.35 +
      (contractType === 'Month-to-Month' ? 1.25 : contractType === '12-Month' ? 0.25 : -0.75) +
      (competitorOfferReceived === 'Yes' ? 1.15 : 0) +
      complaints12M * 0.68 +
      supportTickets12M * 0.18 +
      networkOutages12M * 0.34 +
      (satisfactionScore <= 4 ? 1.2 : satisfactionScore <= 6 ? 0.45 : -0.55) +
      (overageChargesGBP > 10 ? 0.72 : 0) +
      failedPayments12M * 0.62 +
      latePayments12M * 0.25 +
      (autoRenew === 'No' ? 0.52 : -0.25) +
      (directDebit === 'No' ? 0.42 : -0.2) +
      (daysToExpiry >= 0 && daysToExpiry <= 60 ? 0.65 : 0) +
      -0.024 * Math.min(tenureMonths, 48) +
      -0.028 * discountPercent +
      (acquisitionChannel === 'Price Comparison Site' ? 0.35 : 0) +
      (rng() - 0.5) * 0.65;

    const trueChurnProb = 1 / (1 + Math.exp(-logit));
    const churnFlag: 0 | 1 = rng() < trueChurnProb ? 1 : 0;
    const churnStatus: 'Active' | 'Churned' = churnFlag === 1 ? 'Churned' : 'Active';

    let churnDate = '';
    let churnReason = '';
    if (churnFlag === 1) {
      const daysAgo = Math.floor(2 + rng() * 175);
      churnDate = formatDate(addDays(REFERENCE_DATE, -daysAgo));
      if (competitorOfferReceived === 'Yes' && rng() < 0.55) {
        churnReason = 'Competitor Price Offer';
      } else if (networkOutages12M >= 2 && rng() < 0.6) {
        churnReason = 'Repeated Service Outages';
      } else if (complaints12M >= 2 && rng() < 0.6) {
        churnReason = 'Poor Support Resolution';
      } else if (overageChargesGBP >= 10 && rng() < 0.6) {
        churnReason = 'Unexpected Overage Charges';
      } else {
        churnReason = pickWeighted(rng, CHURN_REASONS);
      }
    }

    const lifetimeRevenueGBP = Number(
      Math.max(netSpend, tenureMonths * netSpend * (0.9 + rng() * 0.16)).toFixed(2)
    );
    const monthlyRevenueAtRiskGBP =
      churnFlag === 1 ? Number(netSpend.toFixed(2)) : Number((netSpend * clamp(trueChurnProb, 0.04, 0.96)).toFixed(2));

    rows.push({
      'Customer ID': customerId,
      'Customer Segment': customerSegment,
      Age: age,
      'Age Band': ageBand,
      Gender: gender,
      'UK Nation': ukNation,
      City: city,
      'Acquisition Channel': acquisitionChannel,
      'Join Date': formatDate(joinDate),
      'Tenure Months': tenureMonths,
      'Service Type': serviceType,
      'Plan Name': plan.name,
      'Contract Type': contractType,
      'Contract Start Date': formatDate(contractStartDate),
      'Contract End Date': formatDate(contractEndDate),
      'Auto Renew': autoRenew,
      'Monthly Charge GBP': monthlyChargeGBP,
      'Average Monthly Usage GB': averageMonthlyUsageGB,
      'Data Allowance GB': plan.allowanceGb,
      'Overage Charges GBP': overageChargesGBP,
      'Discount Percent': discountPercent,
      'Payment Method': paymentMethod,
      'Direct Debit': directDebit,
      'Late Payments 12M': latePayments12M,
      'Failed Payments 12M': failedPayments12M,
      'Support Tickets 12M': supportTickets12M,
      'Complaints 12M': complaints12M,
      'Average Resolution Hours': averageResolutionHours,
      'Network Outages 12M': networkOutages12M,
      'Satisfaction Score 1 10': satisfactionScore,
      'NPS Score': npsScore,
      'Competitor Offer Received': competitorOfferReceived,
      'Churn Status': churnStatus,
      'Churn Date': churnDate,
      'Churn Reason': churnReason,
      'Lifetime Revenue GBP': lifetimeRevenueGBP,
      'Monthly Revenue At Risk GBP': monthlyRevenueAtRiskGBP,
      'Churn Flag': churnFlag,
    });
  }

  return rows;
}

export function generateDefaultCampaigns(): RetentionCampaign[] {
  return [
    {
      id: 'camp-fibre-expiry-q4',
      name: 'Q4 Fibre Expiry Loyalty Lock-In',
      targetSegment: 'Contract Expiry Window',
      channel: 'Outbound Call',
      offerType: '15% 12-Month Loyalty Discount + Free Wi-Fi 6 Hub',
      status: 'Active',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      targetCustomers: 118,
      contacted: 94,
      retained: 67,
      campaignCostGBP: 4850,
      revenueSavedGBP: 31240,
      treatmentChurnPct: 11.4,
      controlChurnPct: 29.8,
      createdAt: '2026-10-01T09:00:00Z',
    },
    {
      id: 'camp-service-recovery',
      name: 'Service-Frustrated VIP Recovery Desk',
      targetSegment: 'Service-Frustrated Detractors',
      channel: 'Multi-Channel',
      offerType: '1-Month Bill Credit + Priority Openreach Engineer',
      status: 'Active',
      startDate: '2026-10-15',
      endDate: '2026-12-15',
      targetCustomers: 86,
      contacted: 78,
      retained: 52,
      campaignCostGBP: 5620,
      revenueSavedGBP: 27890,
      treatmentChurnPct: 16.2,
      controlChurnPct: 38.5,
      createdAt: '2026-10-15T10:30:00Z',
    },
    {
      id: 'camp-overage-rightsize',
      name: '5G & Data Overage Tariff Right-Sizing',
      targetSegment: 'Price & Overage Sensitive',
      channel: 'In-App',
      offerType: 'Zero-Penalty Tier Upgrade + Overage Fee Waiver',
      status: 'Completed',
      startDate: '2026-08-01',
      endDate: '2026-10-10',
      targetCustomers: 142,
      contacted: 136,
      retained: 104,
      campaignCostGBP: 2940,
      revenueSavedGBP: 24680,
      treatmentChurnPct: 9.8,
      controlChurnPct: 24.6,
      createdAt: '2026-08-01T08:00:00Z',
    },
  ];
}
