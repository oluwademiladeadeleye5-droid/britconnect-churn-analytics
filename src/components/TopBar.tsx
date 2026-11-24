import React, { useRef, useState } from 'react';
import {
  Search,
  Upload,
  Download,
  MessageSquareText,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Menu,
} from 'lucide-react';
import type { AppView, DatasetMetadata } from '../types/britconnect';

interface TopBarProps {
  activeView: AppView;
  sectionLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  metadata: DatasetMetadata;
  alertCount: number;
  isDark: boolean;
  copilotOpen: boolean;
  onOpenMobileMenu: () => void;
  onToggleTheme: () => void;
  onOpenCommandPalette: () => void;
  onOpenAlertDrawer: () => void;
  onQuickUploadFile: (file: File) => void;
  onQuickExportCSV: () => void;
  onQuickExportExcel: () => void;
  onToggleCopilotDrawer: () => void;
  onRetrainModels: () => void;
  onNavigate: (view: AppView) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  sectionLabel,
  pageTitle,
  pageSubtitle,
  alertCount,
  isDark,
  copilotOpen,
  onOpenMobileMenu,
  onToggleTheme,
  onOpenCommandPalette,
  onOpenAlertDrawer,
  onQuickUploadFile,
  onQuickExportCSV,
  onQuickExportExcel,
  onToggleCopilotDrawer,
  onRetrainModels,
  onNavigate,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0D1E36]/95 backdrop-blur px-3 sm:px-6 py-2.5 sm:py-3">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Menu Button + Dynamic Breadcrumb & 1-Line Subtitle */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden inline-flex min-h-[44px] min-w-[44px] sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#C89B3C] transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] min-w-0">
              <span className="hidden sm:inline shrink-0">{sectionLabel}</span>
              <ChevronRight className="hidden sm:inline h-3 w-3 shrink-0" />
              <span className="text-[#0B1F3A] dark:text-[#E0B44C] font-semibold truncate text-xs sm:text-[11px]">
                {pageTitle}
              </span>
            </div>
            <p className="hidden sm:block mt-0.5 text-xs text-[#475569] dark:text-[#94A3B8] truncate max-w-xl">
              {pageSubtitle}
            </p>
          </div>
        </div>

        {/* Right: Command Palette, Alert Bell, Theme Toggle, Contextual Action & AI Copilot */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Ctrl+K / Cmd+K Command Palette Trigger */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Search customers, views, and actions"
            className="inline-flex h-11 sm:h-9 items-center justify-between gap-2 sm:gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3 text-xs text-[#475569] dark:text-[#94A3B8] hover:border-[#C89B3C] dark:hover:border-[#E0B44C] hover:text-[#0B1F3A] dark:hover:text-white active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
          >
            <span className="inline-flex items-center gap-2">
              <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              <span className="hidden md:inline">Search customers, views, actions...</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-[#CBD5E1] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#475569] dark:text-[#E0B44C]">
              ⌘K
            </kbd>
          </button>

          {/* Alert Bell Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenAlertDrawer}
            aria-label="Open automated alerts"
            className="relative inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#C89B3C] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
          >
            <Bell className="h-4 w-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#8B1E24] dark:bg-[#C93842] px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                {alertCount}
              </span>
            )}
          </button>

          {/* Light / Dark Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={isDark ? 'Switch to Executive Light Mode' : 'Switch to Obsidian Dark Mode'}
            className="inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] text-[#0B1F3A] dark:text-[#E0B44C] hover:border-[#C89B3C] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Hidden Quick Upload Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onQuickUploadFile(file);
                e.target.value = '';
              }
            }}
          />

          {/* Contextual Primary Action */}
          {activeView === 'model-lab' ? (
            <button
              type="button"
              onClick={onRetrainModels}
              className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#C89B3C] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#C89B3C] dark:text-[#E0B44C]" />
              <span>Retrain</span>
            </button>
          ) : activeView === 'playbooks' ? (
            <button
              type="button"
              onClick={() => onNavigate('campaigns')}
              className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#C89B3C] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#C89B3C] dark:text-[#E0B44C]" />
              <span>View Campaigns</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#C89B3C] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Upload className="h-3.5 w-3.5 text-[#0B1F3A] dark:text-[#E0B44C]" />
              <span>Upload Data</span>
            </button>
          )}

          {/* Quick Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              onBlur={() => setTimeout(() => setExportOpen(false), 180)}
              aria-label="Export options"
              className="inline-flex h-11 sm:h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#132847] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#C89B3C] hover:bg-[#F8FAFC] dark:hover:bg-[#1E3A5F] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
            >
              <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="hidden lg:inline">Export</span>
              <ChevronDown className="hidden sm:inline h-3 w-3 text-[#64748B] dark:text-[#94A3B8]" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] shadow-xl py-1.5 z-50">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onQuickExportExcel();
                    setExportOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#132847] cursor-pointer transition-colors"
                >
                  <span>Risk Register (.xlsx)</span>
                  <span className="font-mono text-[10px] text-[#64748B] dark:text-[#94A3B8]">Excel</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onQuickExportCSV();
                    setExportOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#132847] cursor-pointer transition-colors"
                >
                  <span>Risk Register (.csv)</span>
                  <span className="font-mono text-[10px] text-[#64748B] dark:text-[#94A3B8]">CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* AI Copilot Drawer Toggle */}
          <button
            type="button"
            onClick={onToggleCopilotDrawer}
            aria-label="Toggle AI Copilot drawer"
            className={`inline-flex h-11 sm:h-9 items-center gap-1.5 rounded-xl px-3 sm:px-3.5 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C] ${
              copilotOpen
                ? 'bg-[#C89B3C] dark:bg-[#E0B44C] text-[#0B1F3A] shadow-sm'
                : 'bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C]'
            }`}
          >
            <MessageSquareText className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">AI Copilot</span>
          </button>
        </div>
      </div>
    </header>
  );
};
