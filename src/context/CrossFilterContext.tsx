import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { GlobalFilters, PlatformSettings, ScoredCustomerRecord } from '../types/britconnect';
import { isContractExpiringSoon, isHighValueAccount } from '../utils/alerts';

export type ArrayFilterDimension =
  | 'ukNation'
  | 'customerSegment'
  | 'serviceType'
  | 'contractType'
  | 'planName'
  | 'riskTier'
  | 'churnReason'
  | 'tenureCohort'
  | 'probBucket'
  | 'strategicSegment'
  | 'paymentMethod'
  | 'valueRiskQuadrant'
  | 'monthlyTrendMonth'
  | 'campaignChannel'
  | 'campaignStatus';

export interface CrossFilterState {
  ukNation: string[];
  customerSegment: string[];
  serviceType: string[];
  contractType: string[];
  planName: string[];
  riskTier: string[];
  churnStatus: 'All' | 'Churned' | 'Active';
  expiringSoon: boolean;
  churnReason: string[];
  tenureCohort: string[];
  probBucket: string[];
  strategicSegment: string[];
  paymentMethod: string[];
  autoRenew: 'All' | 'Yes' | 'No';
  valueRiskQuadrant: string[];
  monthlyTrendMonth: string[];
  campaignChannel: string[];
  campaignStatus: string[];
  confusionBucket: 'All' | 'TP' | 'FP' | 'FN' | 'TN';
}

export const INITIAL_CROSS_FILTERS: CrossFilterState = {
  ukNation: [],
  customerSegment: [],
  serviceType: [],
  contractType: [],
  planName: [],
  riskTier: [],
  churnStatus: 'All',
  expiringSoon: false,
  churnReason: [],
  tenureCohort: [],
  probBucket: [],
  strategicSegment: [],
  paymentMethod: [],
  autoRenew: 'All',
  valueRiskQuadrant: [],
  monthlyTrendMonth: [],
  campaignChannel: [],
  campaignStatus: [],
  confusionBucket: 'All',
};

export interface ActiveCrossFilterChip {
  id: string;
  dimensionLabel: string;
  valueLabel: string;
  onRemove: () => void;
}

const DIMENSION_LABELS: Record<ArrayFilterDimension, string> = {
  ukNation: 'UK Nation',
  customerSegment: 'Segment',
  serviceType: 'Service',
  contractType: 'Contract',
  planName: 'Plan',
  riskTier: 'Risk Tier',
  churnReason: 'Churn Reason',
  tenureCohort: 'Tenure',
  probBucket: 'Risk Band',
  strategicSegment: 'Strategic Segment',
  paymentMethod: 'Payment',
  valueRiskQuadrant: 'Cluster Quadrant',
  monthlyTrendMonth: 'Churn Month',
  campaignChannel: 'Channel',
  campaignStatus: 'Campaign Status',
};

const TENURE_BOUNDS: Record<string, [number, number]> = {
  '0–6m': [0, 6],
  '7–12m': [7, 12],
  '13–24m': [13, 24],
  '25–36m': [25, 36],
  '37–48m': [37, 48],
  '49m+': [49, 9999],
};

const PROB_BOUNDS: Record<string, [number, number]> = {
  '0–15%': [0, 0.15],
  '15–30%': [0.15, 0.3],
  '30–45%': [0.3, 0.45],
  '45–60%': [0.45, 0.6],
  '60–75%': [0.6, 0.75],
  '75–100%': [0.75, 1.01],
};

export function getValueRiskQuadrant(
  c: ScoredCustomerRecord,
  settings: PlatformSettings
): string {
  const highValue = isHighValueAccount(c, settings);
  const highRisk = c.predictedProbability * 100 >= settings.highThresholdPct;
  if (highValue && highRisk) return 'High Value · High Risk';
  if (highValue && !highRisk) return 'High Value · Low Risk';
  if (!highValue && highRisk) return 'Standard · High Risk';
  return 'Standard · Low Risk';
}

interface CrossFilterContextValue {
  crossFilters: CrossFilterState;
  multiSelectEnabled: boolean;
  setMultiSelectEnabled: (v: boolean) => void;
  toggleDimension: (
    dim: ArrayFilterDimension,
    value: string,
    eventOrMulti?: boolean | { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
  ) => void;
  setDimensionExact: (dim: ArrayFilterDimension, values: string[]) => void;
  toggleHighCriticalRisk: () => void;
  toggleChurnStatus: (target?: 'Churned' | 'Active') => void;
  toggleExpiringSoon: () => void;
  toggleAutoRenew: (val: 'Yes' | 'No') => void;
  setConfusionBucket: (bucket: 'All' | 'TP' | 'FP' | 'FN' | 'TN') => void;
  clearDimension: (dim: keyof CrossFilterState) => void;
  clearAllCrossFilters: () => void;
  clearCampaignCrossFilters: () => void;
  activeCustomerChips: ActiveCrossFilterChip[];
  activeCampaignChips: ActiveCrossFilterChip[];
  filterCustomers: (
    rows: ScoredCustomerRecord[],
    globalFilters: GlobalFilters | null,
    settings: PlatformSettings,
    excludeDimensions?: Array<keyof CrossFilterState>
  ) => ScoredCustomerRecord[];
  isDimensionSelected: (dim: ArrayFilterDimension, value: string) => boolean;
  hasDimensionFilter: (dim: ArrayFilterDimension) => boolean;
}

const CrossFilterContext = createContext<CrossFilterContextValue | null>(null);

export const CrossFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [crossFilters, setCrossFilters] = useState<CrossFilterState>(INITIAL_CROSS_FILTERS);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);

  const toggleDimension = useCallback(
    (
      dim: ArrayFilterDimension,
      value: string,
      eventOrMulti?: boolean | { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
    ) => {
      const isMulti =
        typeof eventOrMulti === 'boolean'
          ? eventOrMulti
          : Boolean(
              multiSelectEnabled ||
                eventOrMulti?.ctrlKey ||
                eventOrMulti?.metaKey ||
                eventOrMulti?.shiftKey
            );

      setCrossFilters((prev) => {
        const current = prev[dim];
        const exists = current.includes(value);
        let next: string[];

        if (isMulti) {
          next = exists ? current.filter((v) => v !== value) : [...current, value];
        } else {
          next = exists && current.length === 1 ? [] : [value];
        }

        return { ...prev, [dim]: next };
      });
    },
    [multiSelectEnabled]
  );

  const setDimensionExact = useCallback((dim: ArrayFilterDimension, values: string[]) => {
    setCrossFilters((prev) => ({ ...prev, [dim]: values }));
  }, []);

  const toggleHighCriticalRisk = useCallback(() => {
    setCrossFilters((prev) => {
      const isCurrentlyHighCrit =
        prev.riskTier.length === 2 &&
        prev.riskTier.includes('Critical') &&
        prev.riskTier.includes('High');
      return {
        ...prev,
        riskTier: isCurrentlyHighCrit ? [] : ['Critical', 'High'],
      };
    });
  }, []);

  const toggleChurnStatus = useCallback((target: 'Churned' | 'Active' = 'Churned') => {
    setCrossFilters((prev) => ({
      ...prev,
      churnStatus: prev.churnStatus === target ? 'All' : target,
    }));
  }, []);

  const toggleExpiringSoon = useCallback(() => {
    setCrossFilters((prev) => ({
      ...prev,
      expiringSoon: !prev.expiringSoon,
    }));
  }, []);

  const toggleAutoRenew = useCallback((val: 'Yes' | 'No') => {
    setCrossFilters((prev) => ({
      ...prev,
      autoRenew: prev.autoRenew === val ? 'All' : val,
    }));
  }, []);

  const setConfusionBucket = useCallback((bucket: 'All' | 'TP' | 'FP' | 'FN' | 'TN') => {
    setCrossFilters((prev) => ({
      ...prev,
      confusionBucket: prev.confusionBucket === bucket ? 'All' : bucket,
    }));
  }, []);

  const clearDimension = useCallback((dim: keyof CrossFilterState) => {
    setCrossFilters((prev) => {
      if (dim === 'churnStatus' || dim === 'autoRenew' || dim === 'confusionBucket') {
        return { ...prev, [dim]: 'All' };
      }
      if (dim === 'expiringSoon') {
        return { ...prev, expiringSoon: false };
      }
      return { ...prev, [dim]: [] };
    });
  }, []);

  const clearAllCrossFilters = useCallback(() => {
    setCrossFilters((prev) => ({
      ...INITIAL_CROSS_FILTERS,
      campaignChannel: prev.campaignChannel,
      campaignStatus: prev.campaignStatus,
    }));
  }, []);

  const clearCampaignCrossFilters = useCallback(() => {
    setCrossFilters((prev) => ({
      ...prev,
      campaignChannel: [],
      campaignStatus: [],
    }));
  }, []);

  const isDimensionSelected = useCallback(
    (dim: ArrayFilterDimension, value: string) => crossFilters[dim].includes(value),
    [crossFilters]
  );

  const hasDimensionFilter = useCallback(
    (dim: ArrayFilterDimension) => crossFilters[dim].length > 0,
    [crossFilters]
  );

  const activeCustomerChips = useMemo<ActiveCrossFilterChip[]>(() => {
    const chips: ActiveCrossFilterChip[] = [];

    const customerArrayDims: ArrayFilterDimension[] = [
      'ukNation',
      'customerSegment',
      'serviceType',
      'contractType',
      'planName',
      'riskTier',
      'churnReason',
      'tenureCohort',
      'probBucket',
      'strategicSegment',
      'paymentMethod',
      'valueRiskQuadrant',
      'monthlyTrendMonth',
    ];

    for (const dim of customerArrayDims) {
      for (const val of crossFilters[dim]) {
        chips.push({
          id: `${dim}:${val}`,
          dimensionLabel: DIMENSION_LABELS[dim],
          valueLabel: val,
          onRemove: () => {
            setCrossFilters((prev) => ({
              ...prev,
              [dim]: prev[dim].filter((x) => x !== val),
            }));
          },
        });
      }
    }

    if (crossFilters.churnStatus !== 'All') {
      chips.push({
        id: `churnStatus:${crossFilters.churnStatus}`,
        dimensionLabel: 'Account Status',
        valueLabel: crossFilters.churnStatus,
        onRemove: () => setCrossFilters((prev) => ({ ...prev, churnStatus: 'All' })),
      });
    }

    if (crossFilters.expiringSoon) {
      chips.push({
        id: 'expiringSoon:true',
        dimensionLabel: 'Contract Window',
        valueLabel: 'Expiring Soon',
        onRemove: () => setCrossFilters((prev) => ({ ...prev, expiringSoon: false })),
      });
    }

    if (crossFilters.autoRenew !== 'All') {
      chips.push({
        id: `autoRenew:${crossFilters.autoRenew}`,
        dimensionLabel: 'Auto Renew',
        valueLabel: crossFilters.autoRenew,
        onRemove: () => setCrossFilters((prev) => ({ ...prev, autoRenew: 'All' })),
      });
    }

    return chips;
  }, [crossFilters]);

  const activeCampaignChips = useMemo<ActiveCrossFilterChip[]>(() => {
    const chips: ActiveCrossFilterChip[] = [];
    for (const dim of ['campaignChannel', 'campaignStatus'] as const) {
      for (const val of crossFilters[dim]) {
        chips.push({
          id: `${dim}:${val}`,
          dimensionLabel: DIMENSION_LABELS[dim],
          valueLabel: val,
          onRemove: () => {
            setCrossFilters((prev) => ({
              ...prev,
              [dim]: prev[dim].filter((x) => x !== val),
            }));
          },
        });
      }
    }
    return chips;
  }, [crossFilters]);

  const filterCustomers = useCallback(
    (
      rows: ScoredCustomerRecord[],
      globalFilters: GlobalFilters | null,
      settings: PlatformSettings,
      excludeDimensions: Array<keyof CrossFilterState> = []
    ): ScoredCustomerRecord[] => {
      const excluded = new Set(excludeDimensions);

      return rows.filter((r) => {
        if (globalFilters) {
          if (globalFilters.ukNation !== 'All' && r['UK Nation'] !== globalFilters.ukNation) return false;
          if (
            globalFilters.customerSegment !== 'All' &&
            r['Customer Segment'] !== globalFilters.customerSegment
          )
            return false;
          if (globalFilters.serviceType !== 'All' && r['Service Type'] !== globalFilters.serviceType)
            return false;
          if (
            globalFilters.contractType !== 'All' &&
            r['Contract Type'] !== globalFilters.contractType
          )
            return false;
          if (globalFilters.planName !== 'All' && r['Plan Name'] !== globalFilters.planName) return false;
          if (globalFilters.riskTier !== 'All' && r.riskTier !== globalFilters.riskTier) return false;
        }

        if (!excluded.has('ukNation') && crossFilters.ukNation.length > 0) {
          if (!crossFilters.ukNation.includes(r['UK Nation'])) return false;
        }
        if (!excluded.has('customerSegment') && crossFilters.customerSegment.length > 0) {
          if (!crossFilters.customerSegment.includes(r['Customer Segment'])) return false;
        }
        if (!excluded.has('serviceType') && crossFilters.serviceType.length > 0) {
          if (!crossFilters.serviceType.includes(r['Service Type'])) return false;
        }
        if (!excluded.has('contractType') && crossFilters.contractType.length > 0) {
          if (!crossFilters.contractType.includes(r['Contract Type'])) return false;
        }
        if (!excluded.has('planName') && crossFilters.planName.length > 0) {
          if (!crossFilters.planName.includes(r['Plan Name'])) return false;
        }
        if (!excluded.has('riskTier') && crossFilters.riskTier.length > 0) {
          if (!crossFilters.riskTier.includes(r.riskTier)) return false;
        }
        if (!excluded.has('churnStatus') && crossFilters.churnStatus !== 'All') {
          const isChurned = r['Churn Flag'] === 1;
          if (crossFilters.churnStatus === 'Churned' && !isChurned) return false;
          if (crossFilters.churnStatus === 'Active' && isChurned) return false;
        }
        if (!excluded.has('expiringSoon') && crossFilters.expiringSoon) {
          if (!isContractExpiringSoon(r, settings)) return false;
        }
        if (!excluded.has('churnReason') && crossFilters.churnReason.length > 0) {
          const reason = r['Churn Reason'] || 'Unspecified';
          if (r['Churn Flag'] !== 1 || !crossFilters.churnReason.includes(reason)) return false;
        }
        if (!excluded.has('tenureCohort') && crossFilters.tenureCohort.length > 0) {
          const matchesTenure = crossFilters.tenureCohort.some((label) => {
            const bounds = TENURE_BOUNDS[label];
            if (!bounds) return false;
            return r['Tenure Months'] >= bounds[0] && r['Tenure Months'] <= bounds[1];
          });
          if (!matchesTenure) return false;
        }
        if (!excluded.has('probBucket') && crossFilters.probBucket.length > 0) {
          const matchesProb = crossFilters.probBucket.some((label) => {
            const bounds = PROB_BOUNDS[label];
            if (!bounds) return false;
            return r.predictedProbability >= bounds[0] && r.predictedProbability < bounds[1];
          });
          if (!matchesProb) return false;
        }
        if (!excluded.has('strategicSegment') && crossFilters.strategicSegment.length > 0) {
          if (!crossFilters.strategicSegment.includes(r.strategicSegment)) return false;
        }
        if (!excluded.has('paymentMethod') && crossFilters.paymentMethod.length > 0) {
          if (!crossFilters.paymentMethod.includes(r['Payment Method'])) return false;
        }
        if (!excluded.has('autoRenew') && crossFilters.autoRenew !== 'All') {
          if (r['Auto Renew'] !== crossFilters.autoRenew) return false;
        }
        if (!excluded.has('valueRiskQuadrant') && crossFilters.valueRiskQuadrant.length > 0) {
          const q = getValueRiskQuadrant(r, settings);
          if (!crossFilters.valueRiskQuadrant.includes(q)) return false;
        }
        if (!excluded.has('monthlyTrendMonth') && crossFilters.monthlyTrendMonth.length > 0) {
          if (r['Churn Flag'] !== 1 || !r['Churn Date']) return false;
          const ym = r['Churn Date'].slice(0, 7);
          if (!/^\d{4}-\d{2}$/.test(ym)) return false;
          const d = new Date(`${ym}-01T00:00:00Z`);
          const label = Number.isNaN(d.getTime())
            ? ym
            : new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(d);
          if (!crossFilters.monthlyTrendMonth.includes(label)) return false;
        }

        return true;
      });
    },
    [crossFilters]
  );

  const value = useMemo<CrossFilterContextValue>(
    () => ({
      crossFilters,
      multiSelectEnabled,
      setMultiSelectEnabled,
      toggleDimension,
      setDimensionExact,
      toggleHighCriticalRisk,
      toggleChurnStatus,
      toggleExpiringSoon,
      toggleAutoRenew,
      setConfusionBucket,
      clearDimension,
      clearAllCrossFilters,
      clearCampaignCrossFilters,
      activeCustomerChips,
      activeCampaignChips,
      filterCustomers,
      isDimensionSelected,
      hasDimensionFilter,
    }),
    [
      crossFilters,
      multiSelectEnabled,
      toggleDimension,
      setDimensionExact,
      toggleHighCriticalRisk,
      toggleChurnStatus,
      toggleExpiringSoon,
      toggleAutoRenew,
      setConfusionBucket,
      clearDimension,
      clearAllCrossFilters,
      clearCampaignCrossFilters,
      activeCustomerChips,
      activeCampaignChips,
      filterCustomers,
      isDimensionSelected,
      hasDimensionFilter,
    ]
  );

  return <CrossFilterContext.Provider value={value}>{children}</CrossFilterContext.Provider>;
};

export function useCrossFilter(): CrossFilterContextValue {
  const ctx = useContext(CrossFilterContext);
  if (!ctx) {
    throw new Error('useCrossFilter must be used within a CrossFilterProvider');
  }
  return ctx;
}
