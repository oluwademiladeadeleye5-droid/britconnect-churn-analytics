import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
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
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import type { AppView, DatasetMetadata } from '../types/britconnect';
import { formatNumber } from '../utils/formatters';

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  criticalCount: number;
  watchlistCount: number;
  activeCampaignCount: number;
  metadata: DatasetMetadata;
  isDark: boolean;
  onToggleTheme: () => void;
}

interface NavGroup {
  title: string;
  items: Array<{
    id: AppView;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    badgeTone?: 'crimson' | 'gold';
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  criticalCount,
  watchlistCount,
  activeCampaignCount,
  metadata,
  isDark,
  onToggleTheme,
}) => {
  const groups: NavGroup[] = [
    {
      title: 'INTELLIGENCE',
      items: [
        { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
        {
          id: 'customers',
          label: 'Customer Intelligence',
          icon: Users,
          badge: criticalCount,
          badgeTone: 'crimson',
        },
        {
          id: 'watchlist',
          label: 'Watchlist & Alerts',
          icon: BellRing,
          badge: watchlistCount,
          badgeTone: 'gold',
        },
      ],
    },
    {
      title: 'DATA & PREDICTIVE AI',
      items: [
        { id: 'data-hub', label: 'Data Hub & Studio', icon: Database },
        { id: 'model-lab', label: 'ML Model Lab', icon: BrainCircuit },
      ],
    },
    {
      title: 'ACTION & RETENTION',
      items: [
        { id: 'playbooks', label: 'AI Retention Playbooks', icon: Sparkles },
        {
          id: 'campaigns',
          label: 'Campaign Tracker',
          icon: Megaphone,
          badge: activeCampaignCount,
          badgeTone: 'gold',
        },
        { id: 'copilot', label: 'BritConnect AI Copilot', icon: MessageSquareText },
      ],
    },
    {
      title: 'OUTPUTS & SYSTEM',
      items: [
        { id: 'reports', label: 'Reports & Exports', icon: FileBarChart2 },
        { id: 'settings', label: 'Platform Settings', icon: Settings },
      ],
    },
  ];

  const modelLabel = metadata.championModelId === 'gbdt' ? 'GBDT Ensemble' : 'L2 LogReg';

  const renderNavContent = (isCompactRail: boolean, isMobileDrawer: boolean) => (
    <>
      {/* Brand Lockup */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C89B3C] dark:bg-[#E0B44C] text-[#0B1F3A] font-display font-bold text-base shadow-xs">
            BC
          </div>
          {!isCompactRail && (
            <div className="min-w-0">
              <div className="font-display text-sm font-bold tracking-tight text-white whitespace-nowrap">
                BritConnect
              </div>
              <div className="text-[11px] text-slate-300 whitespace-nowrap">
                Churn Intelligence
              </div>
            </div>
          )}
        </div>

        {isMobileDrawer ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCompactRail ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCompactRail ? 'Expand navigation' : 'Collapse to icon rail'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            {isCompactRail ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 space-y-5 px-2.5 py-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title}>
            {!isCompactRail ? (
              <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-[0.08em] text-slate-400">
                {group.title}
              </div>
            ) : (
              <div className="mx-3 mb-2 h-px bg-white/10" aria-hidden="true" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      if (isMobileDrawer) onCloseMobile();
                    }}
                    title={isCompactRail ? item.label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 ${
                      isMobileDrawer ? 'min-h-[44px] py-2.5' : 'py-2'
                    } text-left text-[13px] font-medium transition-colors cursor-pointer active:opacity-80 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId={isMobileDrawer ? 'sidebarMobileHighlight' : 'sidebarActiveHighlight'}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 rounded-lg bg-[#16325C] dark:bg-[#0D1E36] ring-1 ring-[#C89B3C]/50 dark:ring-[#E0B44C]/50"
                      />
                    )}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#C89B3C] dark:bg-[#E0B44C] z-10"
                      />
                    )}
                    <Icon
                      className={`relative z-10 h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#D4AF37] dark:text-[#E0B44C]'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!isCompactRail && (
                      <span className="relative z-10 flex-1 truncate">{item.label}</span>
                    )}
                    {!isCompactRail && typeof item.badge === 'number' && item.badge > 0 && (
                      <span
                        className={`relative z-10 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                          item.badgeTone === 'crimson'
                            ? 'bg-[#8B1E24]/80 text-white'
                            : 'bg-[#C89B3C]/20 text-[#E0B44C]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer Card */}
      <div className="border-t border-white/10 p-3 shrink-0">
        {!isCompactRail ? (
          <div className="rounded-xl bg-[#16325C]/70 dark:bg-[#0D1E36] border border-white/10 p-3 space-y-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-white truncate">
                {metadata.datasetName}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-300 tabular-nums truncate">
                {formatNumber(metadata.rowCount)} rows · {modelLabel} • {metadata.championRocAuc.toFixed(2)} AUC
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[11px] text-slate-300">
                {isDark ? 'Obsidian Dark' : 'Executive Light'}
              </span>
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle Light or Dark mode"
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white transition-colors"
              >
                {isDark ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-[#E0B44C]" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>Dark</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle Light or Dark mode"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-[#E0B44C] transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar (lg+) */}
      <aside
        className={`no-print hidden lg:flex relative flex-col bg-[#0B1F3A] dark:bg-[#040B16] text-white shrink-0 border-r border-[#16325C] dark:border-[#1E3A5F] transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[74px]' : 'w-[264px]'
        }`}
      >
        {renderNavContent(collapsed, false)}
      </aside>

      {/* Mobile / Tablet Slide-Over Navigation Drawer (< lg) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={onCloseMobile}
              className="no-print fixed inset-0 z-40 bg-[#040B16]/60 backdrop-blur-[2px] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="no-print fixed inset-y-0 left-0 z-50 flex w-[276px] max-w-[85vw] flex-col bg-[#0B1F3A] dark:bg-[#040B16] text-white border-r border-[#16325C] dark:border-[#1E3A5F] shadow-2xl lg:hidden"
            >
              {renderNavContent(false, true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
