import React from 'react';
import { Filter, Layers, RotateCcw, X } from 'lucide-react';
import type { ActiveCrossFilterChip } from '../context/CrossFilterContext';
import { useToast } from '../context/ToastContext';

interface ActiveCrossFilterBarProps {
  chips: ActiveCrossFilterChip[];
  multiSelectEnabled: boolean;
  onToggleMultiSelect: () => void;
  onClearAll: () => void;
  matchingCount?: number;
  totalCount?: number;
  unitLabel?: string;
}

export const ActiveCrossFilterBar: React.FC<ActiveCrossFilterBarProps> = ({
  chips,
  multiSelectEnabled,
  onToggleMultiSelect,
  onClearAll,
  matchingCount,
  totalCount,
  unitLabel = 'subscribers',
}) => {
  const { notify } = useToast();

  if (chips.length === 0 && !multiSelectEnabled) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#C89B3C]/45 dark:border-[#E0B44C]/45 bg-[#FFFBEB]/70 dark:bg-[#0D1E36] px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A] dark:text-[#E0B44C] shrink-0">
          <Filter className="h-3.5 w-3.5 text-[#C89B3C] dark:text-[#E0B44C]" />
          <span>Active Cross-Filters:</span>
        </div>

        {chips.length === 0 ? (
          <span className="text-xs text-[#475569] dark:text-[#94A3B8] whitespace-nowrap">
            Multi-select active — tap any bars, slices, or cards to combine filters
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex min-h-[34px] sm:min-h-[30px] items-center gap-1.5 rounded-lg border border-[#C89B3C]/60 dark:border-[#E0B44C]/50 bg-white dark:bg-[#132847] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#8B1E24] dark:hover:border-[#C93842] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
              >
                <span className="text-[#64748B] dark:text-[#94A3B8]">{chip.dimensionLabel}:</span>
                <span className="font-semibold text-[#0B1F3A] dark:text-[#E0B44C]">
                  {chip.valueLabel}
                </span>
                <X className="h-3 w-3 text-[#64748B] dark:text-[#94A3B8]" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {typeof matchingCount === 'number' && typeof totalCount === 'number' && (
          <span className="hidden sm:inline font-mono text-[11px] text-[#475569] dark:text-[#94A3B8] tabular-nums">
            {matchingCount.toLocaleString('en-GB')} / {totalCount.toLocaleString('en-GB')} {unitLabel}
          </span>
        )}

        <button
          type="button"
          onClick={onToggleMultiSelect}
          title="Toggle multi-select mode (or hold Ctrl/Cmd while clicking)"
          className={`inline-flex min-h-[36px] sm:h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
            multiSelectEnabled
              ? 'border-[#C89B3C] dark:border-[#E0B44C] bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16]'
              : 'border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] text-[#475569] dark:text-[#CBD5E1] hover:border-[#C89B3C] hover:text-[#0B1F3A] dark:hover:text-white'
          }`}
        >
          <Layers className="h-3 w-3" />
          <span>Multi-Select {multiSelectEnabled ? 'On' : 'Off'}</span>
        </button>

        {chips.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onClearAll();
              notify('All active cross-filters cleared.', 'info');
            }}
            className="inline-flex min-h-[36px] sm:h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-2.5 text-[11px] font-semibold text-[#8B1E24] dark:text-[#C93842] hover:bg-[#FEF2F2] dark:hover:bg-[#8B1E24]/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>
    </div>
  );
};
