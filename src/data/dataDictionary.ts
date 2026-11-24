import type { CanonicalColumnDef, CustomerCanonicalFields } from '../types/britconnect';

export const BRITCONNECT_COLUMNS: CanonicalColumnDef[] = [
  { no: 1, name: 'Customer ID', label: 'Customer ID', dataType: 'Text', description: 'Unique identifier assigned to each customer.', isTargetOrLeakage: true },
  { no: 2, name: 'Customer Segment', label: 'Customer Segment', dataType: 'Text', description: 'Customer classification (e.g., Consumer, Small Business).' },
  { no: 3, name: 'Age', label: 'Age', dataType: 'Whole Number', description: 'Customer age in years.' },
  { no: 4, name: 'Age Band', label: 'Age Band', dataType: 'Text', description: 'Age grouping used for demographic analysis.' },
  { no: 5, name: 'Gender', label: 'Gender', dataType: 'Text', description: 'Recorded customer gender.' },
  { no: 6, name: 'UK Nation', label: 'UK Nation', dataType: 'Text', description: 'UK constituent nation (England, Scotland, Wales, Northern Ireland).' },
  { no: 7, name: 'City', label: 'City', dataType: 'Text', description: 'Customer city.' },
  { no: 8, name: 'Acquisition Channel', label: 'Acquisition Channel', dataType: 'Text', description: 'Channel through which the customer was acquired.' },
  { no: 9, name: 'Join Date', label: 'Join Date', dataType: 'Date', description: 'Date the customer first joined BritConnect.' },
  { no: 10, name: 'Tenure Months', label: 'Tenure Months', dataType: 'Whole Number', description: 'Length of customer relationship, in months.' },
  { no: 11, name: 'Service Type', label: 'Service Type', dataType: 'Text', description: 'Telecommunications service subscribed to.' },
  { no: 12, name: 'Plan Name', label: 'Plan Name', dataType: 'Text', description: 'Name of the subscription package.' },
  { no: 13, name: 'Contract Type', label: 'Contract Type', dataType: 'Text', description: 'Contract arrangement or term (Month-to-Month, 12-Month, 24-Month).' },
  { no: 14, name: 'Contract Start Date', label: 'Contract Start Date', dataType: 'Date', description: 'Date the current contract began.' },
  { no: 15, name: 'Contract End Date', label: 'Contract End Date', dataType: 'Date', description: 'Scheduled contract expiry date, where applicable.' },
  { no: 16, name: 'Auto Renew', label: 'Auto Renew', dataType: 'Text', description: 'Whether the contract renews automatically (Yes/No).' },
  { no: 17, name: 'Monthly Charge GBP', label: 'Monthly Charge GBP', dataType: 'Decimal Number', description: 'Monthly subscription charge in GBP (£).' },
  { no: 18, name: 'Average Monthly Usage GB', label: 'Average Monthly Usage GB', dataType: 'Decimal Number', description: 'Average monthly data usage in gigabytes.' },
  { no: 19, name: 'Data Allowance GB', label: 'Data Allowance GB', dataType: 'Whole Number', description: 'Included monthly data allowance in gigabytes.' },
  { no: 20, name: 'Overage Charges GBP', label: 'Overage Charges GBP', dataType: 'Decimal Number', description: 'Additional usage charges in GBP (£).' },
  { no: 21, name: 'Discount Percent', label: 'Discount Percent', dataType: 'Decimal Number', description: 'Discount percentage applied to the subscription.' },
  { no: 22, name: 'Payment Method', label: 'Payment Method', dataType: 'Text', description: 'Customer payment method.' },
  { no: 23, name: 'Direct Debit', label: 'Direct Debit', dataType: 'Text', description: 'Whether the customer pays by direct debit (Yes/No).' },
  { no: 24, name: 'Late Payments 12M', label: 'Late Payments 12M', dataType: 'Whole Number', description: 'Number of late payments in the preceding 12 months.' },
  { no: 25, name: 'Failed Payments 12M', label: 'Failed Payments 12M', dataType: 'Whole Number', description: 'Number of failed payments in the preceding 12 months.' },
  { no: 26, name: 'Support Tickets 12M', label: 'Support Tickets 12M', dataType: 'Whole Number', description: 'Number of support tickets in the preceding 12 months.' },
  { no: 27, name: 'Complaints 12M', label: 'Complaints 12M', dataType: 'Whole Number', description: 'Number of complaints in the preceding 12 months.' },
  { no: 28, name: 'Average Resolution Hours', label: 'Average Resolution Hours', dataType: 'Decimal Number', description: 'Average support issue resolution time in hours.' },
  { no: 29, name: 'Network Outages 12M', label: 'Network Outages 12M', dataType: 'Whole Number', description: 'Number of network outages in the preceding 12 months.' },
  { no: 30, name: 'Satisfaction Score 1 10', label: 'Satisfaction Score 1 10', dataType: 'Whole Number', description: 'Customer satisfaction score on a scale from 1 to 10.' },
  { no: 31, name: 'NPS Score', label: 'NPS Score', dataType: 'Whole Number', description: 'Customer advocacy score; higher values indicate stronger advocacy.' },
  { no: 32, name: 'Competitor Offer Received', label: 'Competitor Offer Received', dataType: 'Text', description: 'Whether the customer received an offer from a competitor (Yes/No).' },
  { no: 33, name: 'Churn Status', label: 'Churn Status', dataType: 'Text', description: 'Recorded customer state: Active or Churned.', isTargetOrLeakage: true },
  { no: 34, name: 'Churn Date', label: 'Churn Date', dataType: 'Date', description: 'Cancellation/churn date; typically blank for active customers.', isTargetOrLeakage: true },
  { no: 35, name: 'Churn Reason', label: 'Churn Reason', dataType: 'Text', description: 'Reason for cancellation; typically blank for active customers.', isTargetOrLeakage: true },
  { no: 36, name: 'Lifetime Revenue GBP', label: 'Lifetime Revenue GBP', dataType: 'Decimal Number', description: 'Cumulative recorded revenue from the customer in GBP (£).' },
  { no: 37, name: 'Monthly Revenue At Risk GBP', label: 'Monthly Revenue At Risk GBP', dataType: 'Decimal Number', description: 'Estimated monthly revenue exposed to churn in GBP (£).', isTargetOrLeakage: true },
  { no: 38, name: 'Churn Flag', label: 'Churn Flag', dataType: 'Whole Number', description: 'Binary churn outcome: 1 = Churned, 0 = Active.', isTargetOrLeakage: true },
];

export const LEAKAGE_EXCLUDED_COLUMNS: Array<keyof CustomerCanonicalFields> = [
  'Customer ID',
  'Churn Status',
  'Churn Date',
  'Churn Reason',
  'Monthly Revenue At Risk GBP',
  'Churn Flag',
];

export function normalizeColumnKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./()£]+/g, '');
}

const COLUMN_ALIASES: Record<string, keyof CustomerCanonicalFields> = {
  customerid: 'Customer ID',
  custid: 'Customer ID',
  id: 'Customer ID',
  customersegment: 'Customer Segment',
  segment: 'Customer Segment',
  age: 'Age',
  ageband: 'Age Band',
  agegroup: 'Age Band',
  gender: 'Gender',
  uknation: 'UK Nation',
  nation: 'UK Nation',
  country: 'UK Nation',
  region: 'UK Nation',
  city: 'City',
  town: 'City',
  acquisitionchannel: 'Acquisition Channel',
  channel: 'Acquisition Channel',
  joindate: 'Join Date',
  signupdate: 'Join Date',
  tenuremonths: 'Tenure Months',
  tenure: 'Tenure Months',
  servicetype: 'Service Type',
  service: 'Service Type',
  planname: 'Plan Name',
  plan: 'Plan Name',
  tariff: 'Plan Name',
  contracttype: 'Contract Type',
  contract: 'Contract Type',
  contractstartdate: 'Contract Start Date',
  contractenddate: 'Contract End Date',
  contractexpirydate: 'Contract End Date',
  autorenew: 'Auto Renew',
  monthlychargegbp: 'Monthly Charge GBP',
  monthlycharge: 'Monthly Charge GBP',
  mrcgbp: 'Monthly Charge GBP',
  averagemonthlyusagegb: 'Average Monthly Usage GB',
  avgmonthlyusagegb: 'Average Monthly Usage GB',
  monthlyusagegb: 'Average Monthly Usage GB',
  dataallowancegb: 'Data Allowance GB',
  allowancegb: 'Data Allowance GB',
  overagechargesgbp: 'Overage Charges GBP',
  overagegbp: 'Overage Charges GBP',
  discountpercent: 'Discount Percent',
  discountpct: 'Discount Percent',
  paymentmethod: 'Payment Method',
  directdebit: 'Direct Debit',
  latepayments12m: 'Late Payments 12M',
  failedpayments12m: 'Failed Payments 12M',
  supporttickets12m: 'Support Tickets 12M',
  complaints12m: 'Complaints 12M',
  averageresolutionhours: 'Average Resolution Hours',
  avgresolutionhours: 'Average Resolution Hours',
  networkoutages12m: 'Network Outages 12M',
  satisfactionscore110: 'Satisfaction Score 1 10',
  satisfactionscore: 'Satisfaction Score 1 10',
  csat: 'Satisfaction Score 1 10',
  npsscore: 'NPS Score',
  nps: 'NPS Score',
  competitorofferreceived: 'Competitor Offer Received',
  competitoroffer: 'Competitor Offer Received',
  churnstatus: 'Churn Status',
  churndate: 'Churn Date',
  churnreason: 'Churn Reason',
  lifetimerevenuegbp: 'Lifetime Revenue GBP',
  lifetimerevenue: 'Lifetime Revenue GBP',
  ltvgbp: 'Lifetime Revenue GBP',
  monthlyrevenueatriskgbp: 'Monthly Revenue At Risk GBP',
  revenueatriskgbp: 'Monthly Revenue At Risk GBP',
  churnflag: 'Churn Flag',
  churn: 'Churn Flag',
};

export function matchCanonicalColumn(header: string): {
  canonical: keyof CustomerCanonicalFields | null;
  matchType: 'exact' | 'fuzzy' | 'none';
} {
  const exact = BRITCONNECT_COLUMNS.find((c) => c.name.toLowerCase() === header.trim().toLowerCase());
  if (exact) {
    return { canonical: exact.name, matchType: 'exact' };
  }
  const normalized = normalizeColumnKey(header);
  for (const col of BRITCONNECT_COLUMNS) {
    if (normalizeColumnKey(col.name) === normalized) {
      return { canonical: col.name, matchType: 'fuzzy' };
    }
  }
  if (COLUMN_ALIASES[normalized]) {
    return { canonical: COLUMN_ALIASES[normalized], matchType: 'fuzzy' };
  }
  return { canonical: null, matchType: 'none' };
}
