export type AppView =
  | 'overview'
  | 'customers'
  | 'watchlist'
  | 'data-hub'
  | 'model-lab'
  | 'playbooks'
  | 'campaigns'
  | 'copilot'
  | 'reports'
  | 'settings';

export type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low';
export type NPSTier = 'Detractor' | 'Passive' | 'Promoter';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TableDensity = 'comfortable' | 'compact';
export type AIResponseStyle = 'executive' | 'analytical' | 'frontline';
export type PlaybookHorizon = '30-60-90' | '14-day';
export type MissingValueStrategy = 'impute' | 'drop';
export type ChampionPreference = 'auto' | 'logreg' | 'gbdt';

export interface PlatformSettings {
  // Tab 1: Risk & Scoring Rules
  criticalThresholdPct: number;
  highThresholdPct: number;
  mediumThresholdPct: number;
  highValueMonthlyGBP: number;
  highValueLifetimeGBP: number;
  contractExpiryWindowDays: 30 | 60 | 90;

  // Tab 2: Financial & ROI Assumptions
  defaultOfferCostGBP: number;
  maxDiscountCapPct: number;
  expectedRetentionRatePct: number;
  revenueHorizonMonths: number;
  compactCurrency: boolean;

  // Tab 3: ML Pipeline & Data Governance
  defaultChampionPreference: ChampionPreference;
  trainSplitRatio: 75 | 80 | 85;
  randomSeed: number;
  missingValueStrategy: MissingValueStrategy;

  // Tab 4: AI Copilot & Playbook Preferences
  aiResponseStyle: AIResponseStyle;
  autoIncludeOfcomCompliance: boolean;
  defaultPlaybookHorizon: PlaybookHorizon;

  // Tab 5: Appearance & Workspace
  themeMode: ThemeMode;
  tableDensity: TableDensity;
  defaultLandingPage: 'overview' | 'watchlist' | 'customers';
}

export interface AutomatedAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metricBadge: string;
  targetView: AppView;
  filterHint?: string;
}

export interface CanonicalColumnDef {
  no: number;
  name: keyof CustomerCanonicalFields;
  label: string;
  dataType: 'Text' | 'Whole Number' | 'Decimal Number' | 'Date';
  description: string;
  isTargetOrLeakage?: boolean;
}

export interface CustomerCanonicalFields {
  'Customer ID': string;
  'Customer Segment': string;
  Age: number;
  'Age Band': string;
  Gender: string;
  'UK Nation': string;
  City: string;
  'Acquisition Channel': string;
  'Join Date': string;
  'Tenure Months': number;
  'Service Type': string;
  'Plan Name': string;
  'Contract Type': string;
  'Contract Start Date': string;
  'Contract End Date': string;
  'Auto Renew': 'Yes' | 'No';
  'Monthly Charge GBP': number;
  'Average Monthly Usage GB': number;
  'Data Allowance GB': number;
  'Overage Charges GBP': number;
  'Discount Percent': number;
  'Payment Method': string;
  'Direct Debit': 'Yes' | 'No';
  'Late Payments 12M': number;
  'Failed Payments 12M': number;
  'Support Tickets 12M': number;
  'Complaints 12M': number;
  'Average Resolution Hours': number;
  'Network Outages 12M': number;
  'Satisfaction Score 1 10': number;
  'NPS Score': number;
  'Competitor Offer Received': 'Yes' | 'No';
  'Churn Status': 'Active' | 'Churned';
  'Churn Date': string;
  'Churn Reason': string;
  'Lifetime Revenue GBP': number;
  'Monthly Revenue At Risk GBP': number;
  'Churn Flag': 0 | 1;
}

export interface EngineeredFeatures {
  Data_Utilization_Ratio: number;
  Overage_Intensity: number;
  Net_Monthly_Spend_GBP: number;
  Days_To_Contract_Expiry: number;
  Expiring_Within_60D: 0 | 1;
  Payment_Friction_Score: number;
  Service_Friction_Index: number;
  Resolution_Burden_Hours: number;
  Payment_Stability_Flag: 0 | 1;
  ARPU_To_Lifetime_Ratio: number;
  NPS_Tier: NPSTier;
}

export interface FeatureContribution {
  feature: string;
  label: string;
  contribution: number;
  customerValue: string;
}

export interface ScoredCustomerRecord extends CustomerCanonicalFields, EngineeredFeatures {
  predictedProbability: number;
  riskTier: RiskTier;
  predictedMonthlyRevenueAtRisk: number;
  topRiskDriver: string;
  localContributions: FeatureContribution[];
  strategicSegment: string;
}

export interface SchemaMappingEntry {
  canonicalColumn: keyof CustomerCanonicalFields;
  matchedSourceColumn: string | null;
  status: 'matched' | 'fuzzy' | 'missing';
  sampleValue: string;
  dataType: string;
}

export interface DataQualityReport {
  totalRawRows: number;
  finalRowCount: number;
  duplicatesRemoved: number;
  imputedNumericCount: number;
  imputedCategoricalCount: number;
  rangeCorrectionsCount: number;
  completenessPct: number;
  warnings: string[];
  leakageExcludedColumns: string[];
  targetColumn: string;
  schemaMapping: SchemaMappingEntry[];
  processedAt: string;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface ROCPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  importance: number;
  direction: 'risk' | 'protective' | 'nonlinear';
}

export interface TrainedModelSummary {
  id: 'logreg' | 'gbdt';
  name: string;
  algorithmDescription: string;
  rocAuc: number;
  prAuc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  logLoss: number;
  rocCurve: ROCPoint[];
  confusionMatrix: ConfusionMatrix;
  featureImportance: FeatureImportanceItem[];
  validationPredictions: Array<{
    actual: 0 | 1;
    probability: number;
    monthlyCharge: number;
    customerId?: string;
    city?: string;
    planName?: string;
  }>;
}

export interface EncodedFeatureSpec {
  key: string;
  label: string;
  kind: 'numeric' | 'binary' | 'onehot';
  sourceField: string;
  categoryValue?: string;
  mean: number;
  std: number;
}

export interface DecisionStump {
  featureIndex: number;
  threshold: number;
  leftVal: number;
  rightVal: number;
  weight: number;
}

export interface TrainedModelBundle {
  trainedAt: string;
  trainRowCount: number;
  validationRowCount: number;
  positiveRateTrain: number;
  championModelId: 'logreg' | 'gbdt';
  decisionThreshold: number;
  featureSpecs: EncodedFeatureSpec[];
  logregWeights: number[];
  logregBias: number;
  gbdtBaseLogOdds: number;
  gbdtStumps: DecisionStump[];
  gbdtLearningRate: number;
  models: {
    logreg: TrainedModelSummary;
    gbdt: TrainedModelSummary;
  };
}

export interface StrategicSegment {
  id: string;
  name: string;
  description: string;
  customerCount: number;
  sharePct: number;
  avgChurnRiskPct: number;
  monthlyRevenueAtRiskGBP: number;
  avgMonthlyChargeGBP: number;
  avgTenureMonths: number;
  dominantDriver: string;
  recommendedAction: string;
}

export interface RetentionCampaign {
  id: string;
  name: string;
  targetSegment: string;
  channel: 'Outbound Call' | 'Email' | 'SMS' | 'In-App' | 'Multi-Channel';
  offerType: string;
  status: 'Active' | 'Planned' | 'Completed';
  startDate: string;
  endDate: string;
  targetCustomers: number;
  contacted: number;
  retained: number;
  campaignCostGBP: number;
  revenueSavedGBP: number;
  treatmentChurnPct: number;
  controlChurnPct: number;
  createdAt: string;
}

export interface PlaybookStep {
  stepNumber: number;
  action: string;
  responsibleTeam: string;
  channel: string;
  timeline: string;
}

export interface PlaybookKPI {
  horizon: string;
  metric: string;
  target: string;
}

export interface RetentionPlaybook {
  id: string;
  createdAt: string;
  targetType: 'customer' | 'segment';
  targetId: string;
  targetLabel: string;
  title: string;
  priorityTier: string;
  urgencyWindow: string;
  evidenceDiagnosis: string;
  citedMetrics: string[];
  recommendedOffer: string;
  messagingAngle: string;
  recommendedChannel: string;
  implementationSteps: PlaybookStep[];
  expectedImpact: {
    churnReductionPct: number;
    retainedMonthlyRevenueGBP: number;
    retainedAnnualRevenueGBP: number;
    estimatedInterventionCostGBP: number;
    projectedNetRoiPct: number;
  };
  measurableKpis: PlaybookKPI[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface GlobalFilters {
  ukNation: string;
  customerSegment: string;
  serviceType: string;
  contractType: string;
  planName: string;
  riskTier: string;
}

export interface DatasetMetadata {
  datasetName: string;
  sourceType: 'demo' | 'upload';
  rowCount: number;
  lastSavedAt: string;
  championModelId: 'logreg' | 'gbdt';
  championRocAuc: number;
}

export interface DatasetSnapshot {
  metadata: DatasetMetadata;
  rawRows: Record<string, unknown>[];
  cleanedRows: CustomerCanonicalFields[];
  scoredRows: ScoredCustomerRecord[];
  qualityReport: DataQualityReport;
  modelBundle: TrainedModelBundle;
  segments: StrategicSegment[];
  campaigns: RetentionCampaign[];
  playbooks: RetentionPlaybook[];
  chatHistory: ChatMessage[];
  executiveSummaryMarkdown?: string;
}
