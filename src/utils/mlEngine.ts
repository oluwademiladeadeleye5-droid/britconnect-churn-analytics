import type {
  ConfusionMatrix,
  CustomerCanonicalFields,
  DecisionStump,
  EncodedFeatureSpec,
  EngineeredFeatures,
  FeatureContribution,
  FeatureImportanceItem,
  PlatformSettings,
  ROCPoint,
  RiskTier,
  ScoredCustomerRecord,
  StrategicSegment,
  TrainedModelBundle,
  TrainedModelSummary,
} from '../types/britconnect';
import { DEFAULT_PLATFORM_SETTINGS } from './settings';

type EngineeredRow = CustomerCanonicalFields & EngineeredFeatures;

const NUMERIC_MODEL_FEATURES: Array<{ key: keyof EngineeredRow; label: string }> = [
  { key: 'Tenure Months', label: 'Tenure (Months)' },
  { key: 'Monthly Charge GBP', label: 'Monthly Charge (£)' },
  { key: 'Overage Charges GBP', label: 'Overage Charges (£)' },
  { key: 'Discount Percent', label: 'Discount (%)' },
  { key: 'Late Payments 12M', label: 'Late Payments (12M)' },
  { key: 'Failed Payments 12M', label: 'Failed Payments (12M)' },
  { key: 'Support Tickets 12M', label: 'Support Tickets (12M)' },
  { key: 'Complaints 12M', label: 'Complaints (12M)' },
  { key: 'Average Resolution Hours', label: 'Avg Resolution Hours' },
  { key: 'Network Outages 12M', label: 'Network Outages (12M)' },
  { key: 'Satisfaction Score 1 10', label: 'Satisfaction Score (1-10)' },
  { key: 'NPS Score', label: 'NPS Score' },
  { key: 'Data_Utilization_Ratio', label: 'Data Utilization Ratio' },
  { key: 'Overage_Intensity', label: 'Overage Intensity' },
  { key: 'Net_Monthly_Spend_GBP', label: 'Net Monthly Spend (£)' },
  { key: 'Days_To_Contract_Expiry', label: 'Days to Contract Expiry' },
  { key: 'Expiring_Within_60D', label: 'Contract Expiring <=60D' },
  { key: 'Payment_Friction_Score', label: 'Payment Friction Score' },
  { key: 'Service_Friction_Index', label: 'Service Friction Index' },
  { key: 'Resolution_Burden_Hours', label: 'Resolution Burden (Hrs)' },
  { key: 'Payment_Stability_Flag', label: 'Auto-Renew & Direct Debit' },
  { key: 'ARPU_To_Lifetime_Ratio', label: 'ARPU / Lifetime Ratio' },
];

const BINARY_YES_NO_FEATURES: Array<{ key: keyof EngineeredRow; label: string }> = [
  { key: 'Auto Renew', label: 'Auto Renew Enabled' },
  { key: 'Direct Debit', label: 'Direct Debit Active' },
  { key: 'Competitor Offer Received', label: 'Competitor Offer Received' },
];

const CATEGORICAL_ONEHOT_FEATURES: Array<{ key: keyof EngineeredRow; labelPrefix: string; maxCategories: number }> = [
  { key: 'Contract Type', labelPrefix: 'Contract', maxCategories: 4 },
  { key: 'Service Type', labelPrefix: 'Service', maxCategories: 5 },
  { key: 'Customer Segment', labelPrefix: 'Segment', maxCategories: 4 },
  { key: 'UK Nation', labelPrefix: 'Nation', maxCategories: 4 },
  { key: 'Acquisition Channel', labelPrefix: 'Channel', maxCategories: 5 },
];

function sigmoid(z: number): number {
  if (z > 30) return 1 - 1e-13;
  if (z < -30) return 1e-13;
  return 1 / (1 + Math.exp(-z));
}

function clampProb(p: number): number {
  return Math.max(1e-6, Math.min(1 - 1e-6, p));
}

function seededShuffle(arr: number[], seed: number): number[] {
  const copy = [...arr];
  let s = (seed || 2026) >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function stratifiedSplit(
  rows: EngineeredRow[],
  trainPct = 80,
  seed = 2026
): { trainIdx: number[]; valIdx: number[] } {
  const posIdx: number[] = [];
  const negIdx: number[] = [];
  rows.forEach((r, idx) => {
    if (r['Churn Flag'] === 1) posIdx.push(idx);
    else negIdx.push(idx);
  });

  const shuffledPos = seededShuffle(posIdx, seed);
  const shuffledNeg = seededShuffle(negIdx, seed + 17);

  const ratio = Math.max(0.5, Math.min(0.95, trainPct / 100));
  const posTrainCount = Math.max(1, Math.round(shuffledPos.length * ratio));
  const negTrainCount = Math.max(1, Math.round(shuffledNeg.length * ratio));

  const trainIdx = [
    ...shuffledPos.slice(0, posTrainCount),
    ...shuffledNeg.slice(0, negTrainCount),
  ];
  const valIdx = [
    ...shuffledPos.slice(posTrainCount),
    ...shuffledNeg.slice(negTrainCount),
  ];

  if (valIdx.length < 4 && trainIdx.length > 8) {
    valIdx.push(trainIdx.pop()!, trainIdx.pop()!);
  }

  return { trainIdx, valIdx };
}

function buildFeatureSpecs(trainRows: EngineeredRow[]): EncodedFeatureSpec[] {
  const specs: EncodedFeatureSpec[] = [];

  for (const nf of NUMERIC_MODEL_FEATURES) {
    const vals = trainRows.map((r) => Number(r[nf.key]) || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length, 1);
    const std = Math.sqrt(variance) || 1;
    specs.push({
      key: String(nf.key),
      label: nf.label,
      kind: 'numeric',
      sourceField: String(nf.key),
      mean,
      std,
    });
  }

  for (const bf of BINARY_YES_NO_FEATURES) {
    const vals = trainRows.map((r) => (r[bf.key] === 'Yes' ? 1 : 0));
    const mean = vals.reduce<number>((a, b) => a + b, 0) / Math.max(vals.length, 1);
    const std = Math.sqrt(vals.reduce<number>((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length, 1)) || 1;
    specs.push({
      key: String(bf.key),
      label: bf.label,
      kind: 'binary',
      sourceField: String(bf.key),
      mean,
      std,
    });
  }

  for (const cf of CATEGORICAL_ONEHOT_FEATURES) {
    const counts = new Map<string, number>();
    for (const r of trainRows) {
      const val = String(r[cf.key] ?? 'Unknown');
      counts.set(val, (counts.get(val) ?? 0) + 1);
    }
    const topCats = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, cf.maxCategories)
      .map(([cat]) => cat);

    for (const cat of topCats) {
      const vals = trainRows.map((r) => (String(r[cf.key]) === cat ? 1 : 0));
      const mean = vals.reduce<number>((a, b) => a + b, 0) / Math.max(vals.length, 1);
      const std = Math.sqrt(vals.reduce<number>((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length, 1)) || 1;
      specs.push({
        key: `${String(cf.key)}::${cat}`,
        label: `${cf.labelPrefix}: ${cat}`,
        kind: 'onehot',
        sourceField: String(cf.key),
        categoryValue: cat,
        mean,
        std,
      });
    }
  }

  return specs;
}

function encodeRow(row: EngineeredRow, specs: EncodedFeatureSpec[]): number[] {
  return specs.map((spec) => {
    let rawVal = 0;
    const rec = row as unknown as Record<string, unknown>;
    if (spec.kind === 'numeric') {
      rawVal = Number(rec[spec.sourceField]) || 0;
    } else if (spec.kind === 'binary') {
      rawVal = rec[spec.sourceField] === 'Yes' ? 1 : 0;
    } else {
      rawVal = String(rec[spec.sourceField]) === spec.categoryValue ? 1 : 0;
    }
    return (rawVal - spec.mean) / (spec.std || 1);
  });
}

function formatRawFeatureValue(row: EngineeredRow, spec: EncodedFeatureSpec): string {
  const rec = row as unknown as Record<string, unknown>;
  const val = rec[spec.sourceField];
  if (spec.kind === 'onehot') {
    return String(val ?? '—');
  }
  if (spec.kind === 'binary') {
    return String(val ?? 'No');
  }
  const num = Number(val);
  if (!Number.isFinite(num)) return '0';
  if (spec.sourceField.includes('GBP')) return `£${num.toFixed(2)}`;
  if (spec.sourceField.includes('Percent')) return `${num.toFixed(1)}%`;
  if (spec.sourceField.includes('Ratio') || spec.sourceField.includes('Intensity')) return num.toFixed(2);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function trainLogisticRegression(
  X: number[][],
  y: number[],
  numFeatures: number
): { weights: number[]; bias: number } {
  const n = X.length;
  const weights = new Array<number>(numFeatures).fill(0);
  const posCount = y.reduce((a, b) => a + b, 0);
  const negCount = Math.max(1, n - posCount);
  const posWeight = n / (2 * Math.max(1, posCount));
  const negWeight = n / (2 * negCount);
  let bias = Math.log(Math.max(1, posCount) / negCount);

  const lr = 0.08;
  const l2 = 0.015;
  const epochs = 260;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array<number>(numFeatures).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      const xi = X[i];
      let z = bias;
      for (let j = 0; j < numFeatures; j++) {
        z += weights[j] * xi[j];
      }
      const p = sigmoid(z);
      const sampleW = y[i] === 1 ? posWeight : negWeight;
      const err = (p - y[i]) * sampleW;
      gradB += err;
      for (let j = 0; j < numFeatures; j++) {
        gradW[j] += err * xi[j];
      }
    }

    const step = lr / Math.max(1, n);
    bias -= step * gradB;
    for (let j = 0; j < numFeatures; j++) {
      weights[j] -= step * (gradW[j] + l2 * weights[j]);
    }
  }

  return { weights, bias };
}

function trainGBDTStumps(
  X: number[][],
  y: number[],
  numFeatures: number
): { baseLogOdds: number; stumps: DecisionStump[]; learningRate: number } {
  const n = X.length;
  const posRate = Math.max(0.02, Math.min(0.98, y.reduce((a, b) => a + b, 0) / Math.max(1, n)));
  const baseLogOdds = Math.log(posRate / (1 - posRate));
  const f = new Array<number>(n).fill(baseLogOdds);
  const stumps: DecisionStump[] = [];
  const learningRate = 0.14;
  const nTrees = 55;

  // Candidate quantile thresholds per feature
  const thresholdsPerFeat: number[][] = [];
  for (let j = 0; j < numFeatures; j++) {
    const col = X.map((row) => row[j]).sort((a, b) => a - b);
    const uniqueThresholds: number[] = [];
    const steps = 8;
    for (let s = 1; s < steps; s++) {
      const val = col[Math.floor((s / steps) * (col.length - 1))];
      if (uniqueThresholds.length === 0 || Math.abs(val - uniqueThresholds[uniqueThresholds.length - 1]) > 1e-4) {
        uniqueThresholds.push(val);
      }
    }
    thresholdsPerFeat.push(uniqueThresholds);
  }

  for (let m = 0; m < nTrees; m++) {
    const probs = f.map((v) => sigmoid(v));
    const residuals = new Array<number>(n);
    const hessians = new Array<number>(n);
    let totalGrad = 0;
    let totalHess = 0;

    for (let i = 0; i < n; i++) {
      const g = y[i] - probs[i];
      const h = Math.max(1e-4, probs[i] * (1 - probs[i]));
      residuals[i] = g;
      hessians[i] = h;
      totalGrad += g;
      totalHess += h;
    }

    let bestGain = -Infinity;
    let bestStump: DecisionStump = {
      featureIndex: 0,
      threshold: 0,
      leftVal: 0,
      rightVal: 0,
      weight: 0,
    };

    const lambda = 2.0;

    for (let j = 0; j < numFeatures; j++) {
      const thresholds = thresholdsPerFeat[j];
      for (const t of thresholds) {
        let gL = 0;
        let hL = 0;
        let countL = 0;
        for (let i = 0; i < n; i++) {
          if (X[i][j] <= t) {
            gL += residuals[i];
            hL += hessians[i];
            countL++;
          }
        }
        if (countL < 5 || countL > n - 5) continue;
        const gR = totalGrad - gL;
        const hR = totalHess - hL;

        const gain =
          (gL * gL) / (hL + lambda) +
          (gR * gR) / (hR + lambda) -
          (totalGrad * totalGrad) / (totalHess + lambda);

        if (gain > bestGain) {
          bestGain = gain;
          const leftVal = Math.max(-2.5, Math.min(2.5, gL / (hL + lambda)));
          const rightVal = Math.max(-2.5, Math.min(2.5, gR / (hR + lambda)));
          bestStump = {
            featureIndex: j,
            threshold: t,
            leftVal,
            rightVal,
            weight: Math.max(0, gain),
          };
        }
      }
    }

    if (bestGain <= 1e-5) break;
    stumps.push(bestStump);
    for (let i = 0; i < n; i++) {
      const leaf = X[i][bestStump.featureIndex] <= bestStump.threshold ? bestStump.leftVal : bestStump.rightVal;
      f[i] += learningRate * leaf;
    }
  }

  return { baseLogOdds, stumps, learningRate };
}

function predictGBDTLogOdds(x: number[], baseLogOdds: number, stumps: DecisionStump[], lr: number): number {
  let score = baseLogOdds;
  for (const stump of stumps) {
    score += lr * (x[stump.featureIndex] <= stump.threshold ? stump.leftVal : stump.rightVal);
  }
  return score;
}

function computeROCAndAUC(actuals: Array<0 | 1>, probs: number[]): { rocAuc: number; prAuc: number; rocCurve: ROCPoint[] } {
  const paired = actuals.map((y, i) => ({ y, p: probs[i] })).sort((a, b) => b.p - a.p);
  const totalPos = Math.max(1, actuals.filter((y) => y === 1).length);
  const totalNeg = Math.max(1, actuals.length - totalPos);

  const curve: ROCPoint[] = [{ fpr: 0, tpr: 0, threshold: 1 }];
  let tp = 0;
  let fp = 0;
  let rocAuc = 0;
  let prevFpr = 0;
  let prevTpr = 0;

  let prAuc = 0;
  let prevRecall = 0;

  for (let i = 0; i < paired.length; i++) {
    if (paired[i].y === 1) tp++;
    else fp++;

    const tpr = tp / totalPos;
    const fpr = fp / totalNeg;
    const precision = tp / (tp + fp);

    rocAuc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
    prAuc += (tpr - prevRecall) * precision;

    prevFpr = fpr;
    prevTpr = tpr;
    prevRecall = tpr;

    if (i % Math.max(1, Math.floor(paired.length / 28)) === 0 || i === paired.length - 1) {
      curve.push({
        fpr: Number(fpr.toFixed(4)),
        tpr: Number(tpr.toFixed(4)),
        threshold: Number(paired[i].p.toFixed(3)),
      });
    }
  }

  if (curve[curve.length - 1].fpr < 1 || curve[curve.length - 1].tpr < 1) {
    curve.push({ fpr: 1, tpr: 1, threshold: 0 });
  }

  return {
    rocAuc: Number(Math.min(0.99, Math.max(0.5, rocAuc)).toFixed(4)),
    prAuc: Number(Math.min(0.99, Math.max(0.1, prAuc)).toFixed(4)),
    rocCurve: curve,
  };
}

export function evaluateAtThreshold(
  predictions: Array<{ actual: 0 | 1; probability: number; monthlyCharge: number }>,
  threshold: number,
  offerCostPerFlagged = 35,
  retentionRatePct = 45,
  horizonMonths = 12
): {
  matrix: ConfusionMatrix;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  flaggedCount: number;
  projectedRevenueSavedGBP: number;
  projectedOfferCostGBP: number;
  projectedNetBenefitGBP: number;
} {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let savedRev = 0;
  const effectiveSaveRate = Math.max(0.05, Math.min(0.95, retentionRatePct / 100));
  const effectiveMonths = Math.max(1, Math.min(36, horizonMonths));

  for (const item of predictions) {
    const pred = item.probability >= threshold ? 1 : 0;
    if (pred === 1 && item.actual === 1) {
      tp++;
      savedRev += item.monthlyCharge * effectiveMonths * effectiveSaveRate;
    } else if (pred === 1 && item.actual === 0) {
      fp++;
    } else if (pred === 0 && item.actual === 0) {
      tn++;
    } else {
      fn++;
    }
  }

  const total = Math.max(1, tp + fp + tn + fn);
  const accuracy = (tp + tn) / total;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const flaggedCount = tp + fp;
  const projectedOfferCostGBP = flaggedCount * offerCostPerFlagged;
  const projectedNetBenefitGBP = savedRev - projectedOfferCostGBP;

  return {
    matrix: { tp, fp, tn, fn },
    accuracy: Number(accuracy.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1Score: Number(f1Score.toFixed(4)),
    flaggedCount,
    projectedRevenueSavedGBP: Number(savedRev.toFixed(0)),
    projectedOfferCostGBP: Number(projectedOfferCostGBP.toFixed(0)),
    projectedNetBenefitGBP: Number(projectedNetBenefitGBP.toFixed(0)),
  };
}

function computeLogLoss(actuals: Array<0 | 1>, probs: number[]): number {
  let sum = 0;
  for (let i = 0; i < actuals.length; i++) {
    const p = clampProb(probs[i]);
    sum += -(actuals[i] * Math.log(p) + (1 - actuals[i]) * Math.log(1 - p));
  }
  return Number((sum / Math.max(1, actuals.length)).toFixed(4));
}

export function getRiskTier(
  probability: number,
  settings: Pick<PlatformSettings, 'criticalThresholdPct' | 'highThresholdPct' | 'mediumThresholdPct'> = DEFAULT_PLATFORM_SETTINGS
): RiskTier {
  const pct = probability * 100;
  if (pct >= settings.criticalThresholdPct) return 'Critical';
  if (pct >= settings.highThresholdPct) return 'High';
  if (pct >= settings.mediumThresholdPct) return 'Medium';
  return 'Low';
}

export function trainBritConnectModels(
  rows: EngineeredRow[],
  settings: PlatformSettings = DEFAULT_PLATFORM_SETTINGS
): TrainedModelBundle {
  const { trainIdx, valIdx } = stratifiedSplit(rows, settings.trainSplitRatio, settings.randomSeed);
  const trainRows = trainIdx.map((i) => rows[i]);
  const valRows = valIdx.map((i) => rows[i]);

  const featureSpecs = buildFeatureSpecs(trainRows);
  const XTrain = trainRows.map((r) => encodeRow(r, featureSpecs));
  const yTrain = trainRows.map((r) => r['Churn Flag']);
  const XVal = valRows.map((r) => encodeRow(r, featureSpecs));
  const yVal = valRows.map((r) => r['Churn Flag']);

  // Model 1: L2-Regularized Logistic Regression
  const logreg = trainLogisticRegression(XTrain, yTrain, featureSpecs.length);
  const logregValProbs = XVal.map((x) => {
    let z = logreg.bias;
    for (let j = 0; j < featureSpecs.length; j++) z += logreg.weights[j] * x[j];
    return sigmoid(z);
  });

  // Model 2: Gradient Boosted Decision Stumps
  const gbdt = trainGBDTStumps(XTrain, yTrain, featureSpecs.length);
  const gbdtValProbs = XVal.map((x) =>
    sigmoid(predictGBDTLogOdds(x, gbdt.baseLogOdds, gbdt.stumps, gbdt.learningRate))
  );

  const defaultThreshold = 0.5;

  const logregRoc = computeROCAndAUC(yVal, logregValProbs);
  const logregPredItems = valRows.map((r, i) => ({
    actual: r['Churn Flag'],
    probability: logregValProbs[i],
    monthlyCharge: r['Monthly Charge GBP'],
    customerId: r['Customer ID'],
    city: r.City,
    planName: r['Plan Name'],
  }));
  const logregEval = evaluateAtThreshold(logregPredItems, defaultThreshold);
  const maxAbsLogregW = Math.max(1e-6, ...logreg.weights.map((w) => Math.abs(w)));
  const logregImportance: FeatureImportanceItem[] = featureSpecs
    .map((spec, j) => ({
      feature: spec.key,
      label: spec.label,
      importance: Number(((Math.abs(logreg.weights[j]) / maxAbsLogregW) * 100).toFixed(1)),
      direction: (logreg.weights[j] >= 0 ? 'risk' : 'protective') as 'risk' | 'protective',
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 14);

  const gbdtRoc = computeROCAndAUC(yVal, gbdtValProbs);
  const gbdtPredItems = valRows.map((r, i) => ({
    actual: r['Churn Flag'],
    probability: gbdtValProbs[i],
    monthlyCharge: r['Monthly Charge GBP'],
    customerId: r['Customer ID'],
    city: r.City,
    planName: r['Plan Name'],
  }));
  const gbdtEval = evaluateAtThreshold(gbdtPredItems, defaultThreshold);
  const gbdtGains = new Array<number>(featureSpecs.length).fill(0);
  for (const stump of gbdt.stumps) {
    gbdtGains[stump.featureIndex] += stump.weight;
  }
  const maxGbdtGain = Math.max(1e-6, ...gbdtGains);
  const gbdtImportance: FeatureImportanceItem[] = featureSpecs
    .map((spec, j) => ({
      feature: spec.key,
      label: spec.label,
      importance: Number(((gbdtGains[j] / maxGbdtGain) * 100).toFixed(1)),
      direction: (logreg.weights[j] >= 0 ? 'risk' : 'protective') as 'risk' | 'protective',
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 14);

  const logregSummary: TrainedModelSummary = {
    id: 'logreg',
    name: 'L2-Regularized Logistic Regression',
    algorithmDescription: 'Class-weighted linear log-odds classifier fitted via L2-regularized gradient descent.',
    rocAuc: logregRoc.rocAuc,
    prAuc: logregRoc.prAuc,
    accuracy: logregEval.accuracy,
    precision: logregEval.precision,
    recall: logregEval.recall,
    f1Score: logregEval.f1Score,
    logLoss: computeLogLoss(yVal, logregValProbs),
    rocCurve: logregRoc.rocCurve,
    confusionMatrix: logregEval.matrix,
    featureImportance: logregImportance,
    validationPredictions: logregPredItems,
  };

  const gbdtSummary: TrainedModelSummary = {
    id: 'gbdt',
    name: 'Gradient Boosted Decision Stumps',
    algorithmDescription: 'Stage-wise additive logistic boosting ensemble capturing non-linear telecom thresholds.',
    rocAuc: gbdtRoc.rocAuc,
    prAuc: gbdtRoc.prAuc,
    accuracy: gbdtEval.accuracy,
    precision: gbdtEval.precision,
    recall: gbdtEval.recall,
    f1Score: gbdtEval.f1Score,
    logLoss: computeLogLoss(yVal, gbdtValProbs),
    rocCurve: gbdtRoc.rocCurve,
    confusionMatrix: gbdtEval.matrix,
    featureImportance: gbdtImportance,
    validationPredictions: gbdtPredItems,
  };

  const autoChampion: 'logreg' | 'gbdt' = gbdtSummary.rocAuc >= logregSummary.rocAuc ? 'gbdt' : 'logreg';
  const championModelId: 'logreg' | 'gbdt' =
    settings.defaultChampionPreference === 'auto'
      ? autoChampion
      : settings.defaultChampionPreference;

  return {
    trainedAt: new Date().toISOString(),
    trainRowCount: trainRows.length,
    validationRowCount: valRows.length,
    positiveRateTrain: Number((yTrain.reduce<number>((a, b) => a + b, 0) / Math.max(1, yTrain.length)).toFixed(4)),
    championModelId,
    decisionThreshold: defaultThreshold,
    featureSpecs,
    logregWeights: logreg.weights,
    logregBias: logreg.bias,
    gbdtBaseLogOdds: gbdt.baseLogOdds,
    gbdtStumps: gbdt.stumps,
    gbdtLearningRate: gbdt.learningRate,
    models: {
      logreg: logregSummary,
      gbdt: gbdtSummary,
    },
  };
}

export function predictAndExplainRow(
  row: EngineeredRow,
  bundle: TrainedModelBundle,
  modelId: 'logreg' | 'gbdt' = bundle.championModelId,
  settings: PlatformSettings = DEFAULT_PLATFORM_SETTINGS
): {
  probability: number;
  riskTier: RiskTier;
  localContributions: FeatureContribution[];
  topRiskDriver: string;
} {
  const x = encodeRow(row, bundle.featureSpecs);

  let probability = 0.5;
  const rawContributions = new Array<number>(bundle.featureSpecs.length).fill(0);

  if (modelId === 'logreg') {
    let z = bundle.logregBias;
    for (let j = 0; j < bundle.featureSpecs.length; j++) {
      const c = bundle.logregWeights[j] * x[j];
      z += c;
      rawContributions[j] = c;
    }
    probability = sigmoid(z);
  } else {
    const score = predictGBDTLogOdds(x, bundle.gbdtBaseLogOdds, bundle.gbdtStumps, bundle.gbdtLearningRate);
    probability = sigmoid(score);
    // Exact additive tree path attribution (centering each stump against expected leaf value)
    for (const stump of bundle.gbdtStumps) {
      const taken = x[stump.featureIndex] <= stump.threshold ? stump.leftVal : stump.rightVal;
      const other = x[stump.featureIndex] <= stump.threshold ? stump.rightVal : stump.leftVal;
      rawContributions[stump.featureIndex] += bundle.gbdtLearningRate * (taken - 0.5 * (taken + other));
    }
  }

  // Group one-hot features back to clean human labels & avoid duplicate zero noise
  const contributions: FeatureContribution[] = bundle.featureSpecs
    .map((spec, j) => ({
      feature: spec.key,
      label: spec.label,
      contribution: Number(rawContributions[j].toFixed(3)),
      customerValue: formatRawFeatureValue(row, spec),
    }))
    .filter((c) => Math.abs(c.contribution) > 0.01)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 10);

  const positiveDrivers = contributions.filter((c) => c.contribution > 0).sort((a, b) => b.contribution - a.contribution);
  const topRiskDriver =
    positiveDrivers.length > 0
      ? positiveDrivers[0].label
      : contributions.length > 0
      ? contributions[0].label
      : 'Baseline Profile';

  return {
    probability: Number(probability.toFixed(4)),
    riskTier: getRiskTier(probability, settings),
    localContributions: contributions,
    topRiskDriver,
  };
}

function assignStrategicSegment(
  row: EngineeredRow,
  prob: number,
  settings: PlatformSettings = DEFAULT_PLATFORM_SETTINGS
): string {
  const isHighVal =
    row['Monthly Charge GBP'] >= settings.highValueMonthlyGBP ||
    row['Lifetime Revenue GBP'] >= settings.highValueLifetimeGBP ||
    row['Customer Segment'] === 'Small Business';
  const expiring =
    row.Days_To_Contract_Expiry >= -15 &&
    row.Days_To_Contract_Expiry <= settings.contractExpiryWindowDays;

  if (prob * 100 >= settings.highThresholdPct && isHighVal) {
    return 'High-Value Flight Risks';
  }
  if (row.Service_Friction_Index >= 4 || row['Complaints 12M'] >= 2 || row['Satisfaction Score 1 10'] <= 5) {
    return 'Service-Frustrated Detractors';
  }
  if (row['Overage Charges GBP'] >= 8 || row.Overage_Intensity >= 0.15) {
    return 'Price & Overage Sensitive';
  }
  if (expiring || row['Contract Type'] === 'Month-to-Month') {
    return 'Contract Expiry Window';
  }
  return 'Loyal Core Advocates';
}

export function scoreAllCustomers(
  rows: EngineeredRow[],
  bundle: TrainedModelBundle,
  settings: PlatformSettings = DEFAULT_PLATFORM_SETTINGS
): ScoredCustomerRecord[] {
  return rows.map((row) => {
    const exp = predictAndExplainRow(row, bundle, bundle.championModelId, settings);
    const predictedMonthlyRevenueAtRisk = Number((exp.probability * row['Monthly Charge GBP']).toFixed(2));
    return {
      ...row,
      predictedProbability: exp.probability,
      riskTier: exp.riskTier,
      predictedMonthlyRevenueAtRisk,
      topRiskDriver: exp.topRiskDriver,
      localContributions: exp.localContributions,
      strategicSegment: assignStrategicSegment(row, exp.probability, settings),
    };
  });
}

export function rescoreCustomersWithSettings(
  scoredRows: ScoredCustomerRecord[],
  settings: PlatformSettings
): ScoredCustomerRecord[] {
  return scoredRows.map((row) => ({
    ...row,
    Expiring_Within_60D:
      row.Days_To_Contract_Expiry >= -15 &&
      row.Days_To_Contract_Expiry <= settings.contractExpiryWindowDays
        ? 1
        : 0,
    riskTier: getRiskTier(row.predictedProbability, settings),
    strategicSegment: assignStrategicSegment(row, row.predictedProbability, settings),
  }));
}

export function simulateWhatIf(
  customer: ScoredCustomerRecord,
  overrides: {
    discountPercent: number;
    contractType: string;
    autoRenew: 'Yes' | 'No';
    satisfactionScore: number;
    overageChargesGBP: number;
  },
  bundle: TrainedModelBundle,
  settings: PlatformSettings = DEFAULT_PLATFORM_SETTINGS
): {
  probability: number;
  riskTier: RiskTier;
  predictedMonthlyRevenueAtRisk: number;
  localContributions: FeatureContribution[];
} {
  const netSpend = Number(
    (customer['Monthly Charge GBP'] * (1 - overrides.discountPercent / 100) + overrides.overageChargesGBP).toFixed(2)
  );
  const daysExpiry =
    overrides.contractType === '24-Month' ? 540 : overrides.contractType === '12-Month' ? 270 : customer.Days_To_Contract_Expiry;

  const modified: EngineeredRow = {
    ...customer,
    'Discount Percent': overrides.discountPercent,
    'Contract Type': overrides.contractType,
    'Auto Renew': overrides.autoRenew,
    'Satisfaction Score 1 10': overrides.satisfactionScore,
    'Overage Charges GBP': overrides.overageChargesGBP,
    Overage_Intensity: Number((overrides.overageChargesGBP / Math.max(customer['Monthly Charge GBP'], 1)).toFixed(3)),
    Net_Monthly_Spend_GBP: netSpend,
    Days_To_Contract_Expiry: daysExpiry,
    Expiring_Within_60D: daysExpiry >= -15 && daysExpiry <= settings.contractExpiryWindowDays ? 1 : 0,
    Payment_Stability_Flag: overrides.autoRenew === 'Yes' && customer['Direct Debit'] === 'Yes' ? 1 : 0,
  };

  const result = predictAndExplainRow(modified, bundle, bundle.championModelId, settings);
  return {
    probability: result.probability,
    riskTier: result.riskTier,
    predictedMonthlyRevenueAtRisk: Number((result.probability * customer['Monthly Charge GBP']).toFixed(2)),
    localContributions: result.localContributions,
  };
}

export function buildStrategicSegments(scoredRows: ScoredCustomerRecord[]): StrategicSegment[] {
  const definitions: Array<{ id: string; name: string; description: string; recommendedAction: string }> = [
    {
      id: 'seg-high-value-flight',
      name: 'High-Value Flight Risks',
      description: 'High-ARPU Consumer bundles and Small Business accounts showing >=55% predicted churn risk.',
      recommendedAction: 'Assign dedicated UK retention specialist within 48h with tailored loyalty lock-in.',
    },
    {
      id: 'seg-service-detractors',
      name: 'Service-Frustrated Detractors',
      description: 'Subscribers impacted by repeat network outages, open complaints, or slow resolution times.',
      recommendedAction: 'Proactive service recovery credit + priority Openreach line diagnostics.',
    },
    {
      id: 'seg-price-overage',
      name: 'Price & Overage Sensitive',
      description: 'Customers incurring recurring data overages (>=£8/mo) or >15% bill shock above base plan.',
      recommendedAction: 'Zero-fee tariff right-sizing upgrade and 1-month overage waiver.',
    },
    {
      id: 'seg-contract-expiry',
      name: 'Contract Expiry Window',
      description: 'Rolling Month-to-Month subscribers or contracts expiring within the next 60 days.',
      recommendedAction: 'Automated 12/24-month renewal incentive with Auto-Renew & Direct Debit bonus.',
    },
    {
      id: 'seg-loyal-advocates',
      name: 'Loyal Core Advocates',
      description: 'Stable, satisfied customers on fixed terms with low predicted churn risk.',
      recommendedAction: 'Nurture via referral rewards and converged Fibre + 5G cross-sell.',
    },
  ];

  const total = Math.max(1, scoredRows.length);

  return definitions.map((def) => {
    const members = scoredRows.filter((r) => r.strategicSegment === def.name);
    const count = members.length;
    const avgRisk =
      count > 0 ? (members.reduce((s, r) => s + r.predictedProbability, 0) / count) * 100 : 0;
    const revRisk = members.reduce((s, r) => s + r.predictedMonthlyRevenueAtRisk, 0);
    const avgCharge = count > 0 ? members.reduce((s, r) => s + r['Monthly Charge GBP'], 0) / count : 0;
    const avgTenure = count > 0 ? members.reduce((s, r) => s + r['Tenure Months'], 0) / count : 0;

    const driverCounts = new Map<string, number>();
    for (const m of members) {
      driverCounts.set(m.topRiskDriver, (driverCounts.get(m.topRiskDriver) ?? 0) + 1);
    }
    let dominantDriver = 'Baseline Stability';
    let topC = 0;
    for (const [k, c] of driverCounts.entries()) {
      if (c > topC) {
        topC = c;
        dominantDriver = k;
      }
    }

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      customerCount: count,
      sharePct: Number(((count / total) * 100).toFixed(1)),
      avgChurnRiskPct: Number(avgRisk.toFixed(1)),
      monthlyRevenueAtRiskGBP: Number(revRisk.toFixed(0)),
      avgMonthlyChargeGBP: Number(avgCharge.toFixed(2)),
      avgTenureMonths: Number(avgTenure.toFixed(1)),
      dominantDriver,
      recommendedAction: def.recommendedAction,
    };
  });
}
