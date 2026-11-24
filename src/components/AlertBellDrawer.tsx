import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, ShieldAlert, Info, ArrowRight } from 'lucide-react';
import type { AppView, AutomatedAlert } from '../types/britconnect';

interface AlertBellDrawerProps {
  open: boolean;
  onClose: () => void;
  alerts: AutomatedAlert[];
  onNavigateAlert: (view: AppView, filterHint?: string) => void;
}

export const AlertBellDrawer: React.FC<AlertBellDrawerProps> = ({
  open,
  onClose,
  alerts,
  onNavigateAlert,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="no-print fixed inset-0 z-40 bg-[#040B16]/45 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="no-print fixed inset-x-0 bottom-0 h-[85dvh] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto z-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-none bg-white dark:bg-[#0D1E36] border-t sm:border-t-0 sm:border-l border-[#E2E8F0] dark:border-[#1E3A5F] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-4 shrink-0">
              <div>
                <h2 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                  Live Portfolio Alerts
                </h2>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  Computed from your active dataset and Platform Settings rules
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close alerts drawer"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#132847]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC] dark:bg-[#06101F]">
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-8 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
                  No active threshold alerts triggered under current rules.
                </div>
              ) : (
                alerts.map((alert) => {
                  const Icon =
                    alert.severity === 'critical'
                      ? ShieldAlert
                      : alert.severity === 'warning'
                      ? AlertTriangle
                      : Info;

                  return (
                    <div
                      key={alert.id}
                      onClick={() => {
                        onNavigateAlert(alert.targetView, alert.filterHint);
                        onClose();
                      }}
                      className="cursor-pointer rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 hover:border-[#C89B3C] dark:hover:border-[#E0B44C] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              alert.severity === 'critical'
                                ? 'text-[#8B1E24] dark:text-[#C93842]'
                                : alert.severity === 'warning'
                                ? 'text-[#C89B3C] dark:text-[#E0B44C]'
                                : 'text-[#16325C] dark:text-[#4B7BEC]'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-semibold uppercase tracking-wide ${
                              alert.severity === 'critical'
                                ? 'text-[#8B1E24] dark:text-[#C93842]'
                                : alert.severity === 'warning'
                                ? 'text-[#B4821E] dark:text-[#E0B44C]'
                                : 'text-[#16325C] dark:text-[#4B7BEC]'
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                          {alert.metricBadge}
                        </span>
                      </div>

                      <h3 className="mt-2 font-display text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {alert.title}
                      </h3>
                      <p className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                        {alert.description}
                      </p>
                      <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#B4821E] dark:text-[#E0B44C]">
                        <span>Inspect Queue</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
