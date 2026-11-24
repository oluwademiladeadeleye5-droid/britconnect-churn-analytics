import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  LayoutDashboard,
  Users,
  BellRing,
  Database,
  BrainCircuit,
  Sparkles,
  Megaphone,
  MessageSquareText,
  FileBarChart2,
  Settings,
  Sun,
  Moon,
  Upload,
  Download,
  ShieldAlert,
  CornerDownLeft,
} from 'lucide-react';
import type { AppView, ScoredCustomerRecord } from '../types/britconnect';
import { formatPercent } from '../utils/formatters';

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  customers: ScoredCustomerRecord[];
  isDark: boolean;
  onNavigate: (view: AppView) => void;
  onSelectCustomer: (customer: ScoredCustomerRecord) => void;
  onJumpToRiskTier: (tier: string) => void;
  onToggleTheme: () => void;
  onOpenCopilot: () => void;
  onExportExcel: () => void;
  onTriggerUpload: () => void;
}

interface PaletteItem {
  id: string;
  group: 'Pages' | 'Actions' | 'Risk Tiers' | 'Customers';
  label: string;
  sublabel: string;
  icon: React.FC<{ className?: string }>;
  onSelect: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  open,
  onClose,
  customers,
  isDark,
  onNavigate,
  onSelectCustomer,
  onJumpToRiskTier,
  onToggleTheme,
  onOpenCopilot,
  onExportExcel,
  onTriggerUpload,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const pages: PaletteItem[] = [
      { id: 'nav-overview', group: 'Pages', label: 'Executive Overview', sublabel: 'INTELLIGENCE · KPIs & UK Trends', icon: LayoutDashboard, onSelect: () => onNavigate('overview') },
      { id: 'nav-customers', group: 'Pages', label: 'Customer Intelligence & Segments', sublabel: 'INTELLIGENCE · Risk Explorer & Segments', icon: Users, onSelect: () => onNavigate('customers') },
      { id: 'nav-watchlist', group: 'Pages', label: 'Watchlist & Alerts', sublabel: 'INTELLIGENCE · Priority Retention Queue', icon: BellRing, onSelect: () => onNavigate('watchlist') },
      { id: 'nav-data-hub', group: 'Pages', label: 'Data Hub & Pipeline Studio', sublabel: 'DATA & PREDICTIVE AI · Upload & 38-Col Schema', icon: Database, onSelect: () => onNavigate('data-hub') },
      { id: 'nav-model-lab', group: 'Pages', label: 'ML Model Lab & Drivers', sublabel: 'DATA & PREDICTIVE AI · ROC, Threshold & Drivers', icon: BrainCircuit, onSelect: () => onNavigate('model-lab') },
      { id: 'nav-playbooks', group: 'Pages', label: 'AI Retention Playbooks', sublabel: 'ACTION & RETENTION · Gemini Strategy Builder', icon: Sparkles, onSelect: () => onNavigate('playbooks') },
      { id: 'nav-campaigns', group: 'Pages', label: 'Campaign Performance Tracker', sublabel: 'ACTION & RETENTION · ROI & Lift Ledger', icon: Megaphone, onSelect: () => onNavigate('campaigns') },
      { id: 'nav-copilot', group: 'Pages', label: 'BritConnect AI Copilot', sublabel: 'ACTION & RETENTION · Natural-Language Analytics', icon: MessageSquareText, onSelect: () => onNavigate('copilot') },
      { id: 'nav-reports', group: 'Pages', label: 'Reports & Export Center', sublabel: 'OUTPUTS & SYSTEM · Excel, CSV, PDF Briefs', icon: FileBarChart2, onSelect: () => onNavigate('reports') },
      { id: 'nav-settings', group: 'Pages', label: 'Platform Settings', sublabel: 'OUTPUTS & SYSTEM · Thresholds, ML, Theme & Storage', icon: Settings, onSelect: () => onNavigate('settings') },
    ];

    const actions: PaletteItem[] = [
      {
        id: 'act-theme',
        group: 'Actions',
        label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        sublabel: 'Toggle Executive Daylight / Obsidian Dark theme',
        icon: isDark ? Sun : Moon,
        onSelect: onToggleTheme,
      },
      {
        id: 'act-copilot',
        group: 'Actions',
        label: 'Open AI Copilot Drawer',
        sublabel: 'Ask natural-language questions on live dataset',
        icon: MessageSquareText,
        onSelect: onOpenCopilot,
      },
      {
        id: 'act-upload',
        group: 'Actions',
        label: 'Upload New Dataset',
        sublabel: 'Go to Data Hub to ingest .xlsx, .csv, .json, or .tsv',
        icon: Upload,
        onSelect: onTriggerUpload,
      },
      {
        id: 'act-export',
        group: 'Actions',
        label: 'Export Scored Risk Register (.xlsx)',
        sublabel: 'Download full enriched Excel workbook',
        icon: Download,
        onSelect: onExportExcel,
      },
    ];

    const tiers: PaletteItem[] = (['Critical', 'High', 'Medium', 'Low'] as const).map((tier) => ({
      id: `tier-${tier}`,
      group: 'Risk Tiers',
      label: `Jump to ${tier} Risk Customers`,
      sublabel: `Filter Customer Intelligence to ${tier} tier`,
      icon: ShieldAlert,
      onSelect: () => onJumpToRiskTier(tier),
    }));

    const matchedCustomers: PaletteItem[] = (
      q
        ? customers.filter(
            (c) =>
              c['Customer ID'].toLowerCase().includes(q) ||
              c.City.toLowerCase().includes(q) ||
              c['UK Nation'].toLowerCase().includes(q) ||
              c['Plan Name'].toLowerCase().includes(q)
          )
        : [...customers].sort((a, b) => b.predictedProbability - a.predictedProbability)
    )
      .slice(0, q ? 8 : 4)
      .map((c) => ({
        id: `cust-${c['Customer ID']}`,
        group: 'Customers',
        label: `${c['Customer ID']} · ${c.City}, ${c['UK Nation']}`,
        sublabel: `${c['Plan Name']} · ${formatPercent(c.predictedProbability * 100)} risk (${c.riskTier})`,
        icon: Users,
        onSelect: () => onSelectCustomer(c),
      }));

    const base = [...pages, ...actions, ...tiers];
    const filteredBase = q
      ? base.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.sublabel.toLowerCase().includes(q)
        )
      : base.slice(0, 12);

    return [...matchedCustomers, ...filteredBase].slice(0, 14);
  }, [query, customers, isDark, onNavigate, onSelectCustomer, onJumpToRiskTier, onToggleTheme, onOpenCopilot, onExportExcel, onTriggerUpload]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (items.length > 0 ? (i + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (items.length > 0 ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      items[selectedIndex].onSelect();
      onClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
            className="no-print fixed inset-0 z-50 bg-[#040B16]/55 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={handleKeyDown}
            className="no-print fixed left-1/2 top-[8%] sm:top-[12%] z-50 w-[94%] max-w-2xl max-h-[82dvh] flex flex-col -translate-x-1/2 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-2xl overflow-hidden"
          >
            {/* Search Bar */}
            <div className="flex items-center gap-3 border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-4 py-3.5 shrink-0">
              <Search className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to page, search Customer ID / City, switch theme, or filter Risk Tier..."
                className="flex-1 min-w-0 bg-transparent text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#64748B] dark:placeholder:text-[#94A3B8] focus:outline-none"
              />
              <kbd className="rounded border border-[#E2E8F0] dark:border-[#1E3A5F] px-1.5 py-0.5 font-mono text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {items.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                  No matching views, customers, or actions found.
                </div>
              ) : (
                items.map((item, idx) => {
                  const Icon = item.icon;
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => {
                        item.onSelect();
                        onClose();
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                        active
                          ? 'bg-[#0B1F3A] dark:bg-[#132847] text-white ring-1 ring-[#C89B3C]/40 dark:ring-[#E0B44C]/50'
                          : 'text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? 'text-[#E0B44C]' : 'text-[#64748B] dark:text-[#94A3B8]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{item.label}</div>
                          <div
                            className={`text-[11px] truncate ${
                              active ? 'text-slate-300' : 'text-[#64748B] dark:text-[#94A3B8]'
                            }`}
                          >
                            {item.sublabel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-medium ${
                            active ? 'text-[#E0B44C]' : 'text-[#94A3B8]'
                          }`}
                        >
                          {item.group}
                        </span>
                        {active && <CornerDownLeft className="h-3.5 w-3.5 text-[#E0B44C]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
