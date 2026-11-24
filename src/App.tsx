import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig, AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type {
  AppView,
  ChatMessage,
  CustomerCanonicalFields,
  DatasetSnapshot,
  GlobalFilters,
  PlatformSettings,
  RetentionCampaign,
  RetentionPlaybook,
  ScoredCustomerRecord,
  StrategicSegment,
} from './types/britconnect';
import { generateBritConnectDemoDataset, generateDefaultCampaigns } from './data/demoGenerator';
import { cleanAndEngineerDataset, parseUploadedFile } from './utils/dataPipeline';
import {
  buildStrategicSegments,
  rescoreCustomersWithSettings,
  scoreAllCustomers,
  trainBritConnectModels,
} from './utils/mlEngine';
import {
  clearWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from './utils/storage';
import {
  DEFAULT_PLATFORM_SETTINGS,
  loadPlatformSettings,
  loadSidebarCollapsed,
  resolveEffectiveDark,
  savePlatformSettings,
  saveSidebarCollapsed,
} from './utils/settings';
import { computeAutomatedAlerts, computeWatchlistAccounts } from './utils/alerts';
import { buildGroundedAIContext } from './utils/analytics';
import { exportRiskRegisterCSV, exportRiskRegisterExcel } from './utils/exportEngine';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardOverview } from './components/DashboardOverview';
import { DataHubView } from './components/DataHubView';
import { ModelLabView } from './components/ModelLabView';
import { CustomerIntelligenceView } from './components/CustomerIntelligenceView';
import { WatchlistView } from './components/WatchlistView';
import { SettingsView } from './components/SettingsView';
import { Customer360Drawer } from './components/Customer360Drawer';
import { PlaybooksView } from './components/PlaybooksView';
import { CampaignsView } from './components/CampaignsView';
import { CopilotPanel } from './components/CopilotPanel';
import { ReportsCenterView } from './components/ReportsCenterView';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AlertBellDrawer } from './components/AlertBellDrawer';
import { CrossFilterProvider } from './context/CrossFilterContext';
import { ToastProvider, useToast } from './context/ToastContext';

const DEFAULT_FILTERS: GlobalFilters = {
  ukNation: 'All',
  customerSegment: 'All',
  serviceType: 'All',
  contractType: 'All',
  planName: 'All',
  riskTier: 'All',
};

const VIEW_META: Record<AppView, { section: string; title: string; subtitle: string }> = {
  overview: {
    section: 'Intelligence',
    title: 'Executive Churn Overview',
    subtitle: 'Portfolio churn KPIs, UK nation GBP exposure, and longitudinal retention trends',
  },
  customers: {
    section: 'Intelligence',
    title: 'Customer Intelligence & Segments',
    subtitle: 'Strategic subscriber segmentation, value-vs-risk matrix, and individual 360° profiles',
  },
  watchlist: {
    section: 'Intelligence',
    title: 'Watchlist & Priority Alerts',
    subtitle: 'High-value critical accounts, expiring contracts, and competitor offer interventions',
  },
  'data-hub': {
    section: 'Data & Predictive AI',
    title: 'Data Hub & Pipeline Studio',
    subtitle: 'Multi-format ingestion, 38-column BritConnect schema validation, and feature engineering',
  },
  'model-lab': {
    section: 'Data & Predictive AI',
    title: 'ML Model Lab & Drivers',
    subtitle: 'Out-of-sample model benchmarks, ROC analysis, threshold ROI optimizer, and global drivers',
  },
  playbooks: {
    section: 'Action & Retention',
    title: 'AI Retention Playbooks',
    subtitle: 'Evidence-based retention strategies grounded in subscriber telemetry and ROI targets',
  },
  campaigns: {
    section: 'Action & Retention',
    title: 'Campaign Performance Tracker',
    subtitle: 'Active UK retention initiatives, uplift attribution, and net campaign ROI',
  },
  copilot: {
    section: 'Action & Retention',
    title: 'BritConnect AI Copilot',
    subtitle: 'Natural-language analytics workspace grounded in live portfolio statistics and drivers',
  },
  reports: {
    section: 'Outputs & System',
    title: 'Reports & Export Center',
    subtitle: 'Boardroom PDF briefs, scored Excel/CSV risk registers, and campaign packs',
  },
  settings: {
    section: 'Outputs & System',
    title: 'Platform Settings',
    subtitle: 'Risk scoring thresholds, ROI assumptions, ML governance, AI rules, and workspace storage',
  },
};

function buildSnapshotFromRaw(
  datasetName: string,
  sourceType: 'demo' | 'upload',
  rawRows: Record<string, unknown>[],
  settings: PlatformSettings,
  existingCampaigns?: RetentionCampaign[],
  existingPlaybooks?: RetentionPlaybook[],
  existingChat?: ChatMessage[],
  customMapping?: Record<keyof CustomerCanonicalFields, string | null>
): DatasetSnapshot {
  const { cleanedRows, engineeredRows, qualityReport } = cleanAndEngineerDataset(
    rawRows,
    customMapping,
    {
      missingValueStrategy: settings.missingValueStrategy,
      contractExpiryWindowDays: settings.contractExpiryWindowDays,
    }
  );
  const modelBundle = trainBritConnectModels(engineeredRows, settings);
  const scoredRows = scoreAllCustomers(engineeredRows, modelBundle, settings);
  const segments = buildStrategicSegments(scoredRows);
  const now = new Date().toISOString();
  const champion = modelBundle.models[modelBundle.championModelId];

  return {
    metadata: {
      datasetName,
      sourceType,
      rowCount: scoredRows.length,
      lastSavedAt: now,
      championModelId: modelBundle.championModelId,
      championRocAuc: champion.rocAuc,
    },
    rawRows,
    cleanedRows,
    scoredRows,
    qualityReport,
    modelBundle,
    segments,
    campaigns: existingCampaigns ?? generateDefaultCampaigns(),
    playbooks: existingPlaybooks ?? [],
    chatHistory: existingChat ?? [],
  };
}

function AppContent() {
  const { notify } = useToast();
  const [settings, setSettings] = useState<PlatformSettings>(() => loadPlatformSettings());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  const [snapshot, setSnapshot] = useState<DatasetSnapshot | null>(null);
  const [activeView, setActiveView] = useState<AppView>(() => loadPlatformSettings().defaultLandingPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => loadSidebarCollapsed());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const [customerRiskFilterJump, setCustomerRiskFilterJump] = useState<string>('All');
  const [watchlistFilterJump, setWatchlistFilterJump] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<ScoredCustomerRecord | null>(null);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);

  const [isProcessingData, setIsProcessingData] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState(false);
  const [playbookError, setPlaybookError] = useState<string | null>(null);
  const [playbookTargetCustomer, setPlaybookTargetCustomer] = useState<ScoredCustomerRecord | null>(null);
  const [playbookTargetSegment, setPlaybookTargetSegment] = useState<StrategicSegment | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const paletteUploadRef = useRef<HTMLInputElement | null>(null);

  const isDark = useMemo(() => {
    if (settings.themeMode === 'system') return systemPrefersDark;
    return resolveEffectiveDark(settings.themeMode);
  }, [settings.themeMode, systemPrefersDark]);

  // Listen to OS theme preference when themeMode is 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Global Ctrl+K / Cmd+K Command Palette & Esc drawer closing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (copilotDrawerOpen) {
          setCopilotDrawerOpen(false);
        } else if (alertDrawerOpen) {
          setAlertDrawerOpen(false);
        } else if (selectedCustomer) {
          setSelectedCustomer(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copilotDrawerOpen, alertDrawerOpen, selectedCustomer]);

  // Hydrate from IndexedDB without wiping user data, or bootstrap 600-customer demo dataset
  useEffect(() => {
    let mounted = true;
    const currentSettings = loadPlatformSettings();
    (async () => {
      try {
        const saved = await loadWorkspaceSnapshot();
        if (mounted && saved && saved.scoredRows?.length > 0) {
          const rescored = rescoreCustomersWithSettings(saved.scoredRows, currentSettings);
          const segments = buildStrategicSegments(rescored);
          setSnapshot({
            ...saved,
            scoredRows: rescored,
            segments,
          });
          return;
        }
      } catch {
        // fallback to demo dataset
      }
      const demoRaw = generateBritConnectDemoDataset(600) as unknown as Record<string, unknown>[];
      const initial = buildSnapshotFromRaw(
        'BritConnect UK Telecom Demo (600)',
        'demo',
        demoRaw,
        currentSettings
      );
      await saveWorkspaceSnapshot(initial).catch(() => {});
      if (mounted) setSnapshot(initial);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistUpdate = useCallback(async (next: DatasetSnapshot) => {
    const stamped: DatasetSnapshot = {
      ...next,
      metadata: {
        ...next.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    };
    setSnapshot(stamped);
    try {
      await saveWorkspaceSnapshot(stamped);
    } catch {
      // keep in memory even if IndexedDB unavailable
    }
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      saveSidebarCollapsed(next);
      return next;
    });
  };

  const handleToggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark';
    const next = { ...settings, themeMode: nextMode } as PlatformSettings;
    setSettings(next);
    savePlatformSettings(next);
  };

  const handleUpdateSettings = async (
    next: PlatformSettings,
    options?: { retrain?: boolean }
  ) => {
    setSettings(next);
    savePlatformSettings(next);
    if (!snapshot) return;

    if (options?.retrain) {
      setIsProcessingData(true);
      try {
        const rebuilt = buildSnapshotFromRaw(
          snapshot.metadata.datasetName,
          snapshot.metadata.sourceType,
          snapshot.rawRows,
          next,
          snapshot.campaigns,
          snapshot.playbooks,
          snapshot.chatHistory
        );
        await persistUpdate(rebuilt);
        notify('Updated ML pipeline settings and retrained models.');
      } finally {
        setIsProcessingData(false);
      }
      return;
    }

    // Apply champion preference or threshold/high-value/expiry settings live
    let nextBundle = snapshot.modelBundle;
    let nextScored: ScoredCustomerRecord[];

    if (
      next.defaultChampionPreference !== 'auto' &&
      next.defaultChampionPreference !== snapshot.modelBundle.championModelId
    ) {
      nextBundle = {
        ...snapshot.modelBundle,
        championModelId: next.defaultChampionPreference,
      };
      nextScored = scoreAllCustomers(snapshot.scoredRows, nextBundle, next);
    } else {
      nextScored = rescoreCustomersWithSettings(snapshot.scoredRows, next);
    }

    const nextSegments = buildStrategicSegments(nextScored);
    const champ = nextBundle.models[nextBundle.championModelId];

    await persistUpdate({
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        championModelId: nextBundle.championModelId,
        championRocAuc: champ.rocAuc,
      },
      modelBundle: nextBundle,
      scoredRows: nextScored,
      segments: nextSegments,
    });
    notify('Platform settings saved and applied.');
  };

  const handleResetSettings = async () => {
    const fresh = { ...DEFAULT_PLATFORM_SETTINGS };
    await handleUpdateSettings(fresh, { retrain: false });
    notify('Restored default BritConnect platform settings.');
  };

  const handleUploadFile = async (file: File) => {
    if (!snapshot) return;
    setIsProcessingData(true);
    try {
      const parsed = await parseUploadedFile(file);
      const next = buildSnapshotFromRaw(
        parsed.fileName,
        'upload',
        parsed.rows,
        settings,
        snapshot.campaigns,
        snapshot.playbooks,
        []
      );
      await persistUpdate(next);
      setFilters(DEFAULT_FILTERS);
      setSelectedCustomer(null);
      notify(`Loaded "${parsed.fileName}" (${next.metadata.rowCount} records) and retrained ML models.`);
      setActiveView('data-hub');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to parse uploaded file.';
      notify(msg, 'error');
    } finally {
      setIsProcessingData(false);
    }
  };

  const handleLoadDemo = async () => {
    if (!snapshot) return;
    setIsProcessingData(true);
    try {
      const demoRaw = generateBritConnectDemoDataset(600) as unknown as Record<string, unknown>[];
      const next = buildSnapshotFromRaw(
        'BritConnect UK Telecom Demo (600)',
        'demo',
        demoRaw,
        settings,
        generateDefaultCampaigns(),
        snapshot.playbooks,
        []
      );
      await persistUpdate(next);
      setFilters(DEFAULT_FILTERS);
      setSelectedCustomer(null);
      notify('Loaded BritConnect 600-customer UK Telecom Demo Dataset.');
    } finally {
      setIsProcessingData(false);
    }
  };

  const handleResetData = async () => {
    setIsProcessingData(true);
    try {
      await clearWorkspaceSnapshot().catch(() => {});
      const demoRaw = generateBritConnectDemoDataset(600) as unknown as Record<string, unknown>[];
      const fresh = buildSnapshotFromRaw(
        'BritConnect UK Telecom Demo (600)',
        'demo',
        demoRaw,
        settings
      );
      await persistUpdate(fresh);
      setFilters(DEFAULT_FILTERS);
      setSelectedCustomer(null);
      notify('Workspace reset to default BritConnect Demo Dataset.');
    } finally {
      setIsProcessingData(false);
    }
  };

  const handleRemapSchema = async (
    mapping: Record<keyof CustomerCanonicalFields, string | null>
  ) => {
    if (!snapshot) return;
    setIsProcessingData(true);
    try {
      const next = buildSnapshotFromRaw(
        snapshot.metadata.datasetName,
        snapshot.metadata.sourceType,
        snapshot.rawRows,
        settings,
        snapshot.campaigns,
        snapshot.playbooks,
        snapshot.chatHistory,
        mapping
      );
      await persistUpdate(next);
      notify('Applied custom 38-column schema mapping and retrained ML pipeline.');
    } finally {
      setIsProcessingData(false);
    }
  };

  const handleSelectChampion = async (modelId: 'logreg' | 'gbdt') => {
    if (!snapshot) return;
    const updatedBundle = {
      ...snapshot.modelBundle,
      championModelId: modelId,
    };
    const rescored = scoreAllCustomers(snapshot.scoredRows, updatedBundle, settings);
    const updatedSegments = buildStrategicSegments(rescored);
    const champ = updatedBundle.models[modelId];
    await persistUpdate({
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        championModelId: modelId,
        championRocAuc: champ.rocAuc,
      },
      modelBundle: updatedBundle,
      scoredRows: rescored,
      segments: updatedSegments,
    });
    notify(`Active champion switched to ${champ.name}.`);
  };

  const handleUpdateThreshold = async (threshold: number) => {
    if (!snapshot) return;
    await persistUpdate({
      ...snapshot,
      modelBundle: {
        ...snapshot.modelBundle,
        decisionThreshold: threshold,
      },
    });
  };

  const handleRetrainModels = async () => {
    if (!snapshot) return;
    setIsProcessingData(true);
    try {
      const nextBundle = trainBritConnectModels(snapshot.scoredRows, settings);
      const rescored = scoreAllCustomers(snapshot.scoredRows, nextBundle, settings);
      const updatedSegments = buildStrategicSegments(rescored);
      const champ = nextBundle.models[nextBundle.championModelId];
      await persistUpdate({
        ...snapshot,
        metadata: {
          ...snapshot.metadata,
          championModelId: nextBundle.championModelId,
          championRocAuc: champ.rocAuc,
        },
        modelBundle: nextBundle,
        scoredRows: rescored,
        segments: updatedSegments,
      });
      notify(`Models retrained cleanly. Champion ROC-AUC: ${champ.rocAuc.toFixed(3)}.`);
    } finally {
      setIsProcessingData(false);
    }
  };

  const handleSendChatMessage = async (text: string) => {
    if (!snapshot) return;
    setChatError(null);
    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const withUser: DatasetSnapshot = {
      ...snapshot,
      chatHistory: [...snapshot.chatHistory, userMsg],
    };
    setSnapshot(withUser);
    setIsSendingChat(true);

    try {
      const groundedContext = buildGroundedAIContext(snapshot);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: snapshot.chatHistory.map((m) => ({ role: m.role, content: m.content })),
          groundedContext,
          aiSettings: {
            aiResponseStyle: settings.aiResponseStyle,
            autoIncludeOfcomCompliance: settings.autoIncludeOfcomCompliance,
            maxDiscountCapPct: settings.maxDiscountCapPct,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to reach AI Copilot.');
      }
      const assistantMsg: ChatMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
      };
      await persistUpdate({
        ...withUser,
        chatHistory: [...withUser.chatHistory, assistantMsg],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI Copilot.';
      setChatError(msg);
      await persistUpdate(withUser);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleClearChat = async () => {
    if (!snapshot) return;
    setChatError(null);
    await persistUpdate({
      ...snapshot,
      chatHistory: [],
    });
  };

  const handleGeneratePlaybook = async (
    targetType: 'customer' | 'segment',
    targetId: string
  ) => {
    if (!snapshot) return;
    setPlaybookError(null);
    setIsGeneratingPlaybook(true);

    let targetData: unknown = null;
    let targetLabel = targetId;

    if (targetType === 'customer') {
      const cust = snapshot.scoredRows.find((c) => c['Customer ID'] === targetId);
      if (!cust) {
        setIsGeneratingPlaybook(false);
        return;
      }
      targetData = cust;
      targetLabel = `${cust['Customer ID']} (${cust.City}, ${cust['Plan Name']})`;
    } else {
      const seg = snapshot.segments.find((s) => s.id === targetId);
      if (!seg) {
        setIsGeneratingPlaybook(false);
        return;
      }
      const sampleMembers = snapshot.scoredRows
        .filter((c) => c.strategicSegment === seg.name)
        .sort((a, b) => b.predictedProbability - a.predictedProbability)
        .slice(0, 6)
        .map((c) => ({
          id: c['Customer ID'],
          chargeGBP: c['Monthly Charge GBP'],
          overageGBP: c['Overage Charges GBP'],
          complaints12M: c['Complaints 12M'],
          outages12M: c['Network Outages 12M'],
          contract: c['Contract Type'],
          riskPct: Number((c.predictedProbability * 100).toFixed(1)),
          topDriver: c.topRiskDriver,
        }));
      targetData = { ...seg, sampleTopRiskAccounts: sampleMembers };
      targetLabel = seg.name;
    }

    try {
      const grounded = buildGroundedAIContext(snapshot);
      const res = await fetch('/api/ai/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetData,
          datasetSummary: {
            portfolioKpis: grounded.portfolioKpis,
            championModel: grounded.championModel,
          },
          aiSettings: {
            aiResponseStyle: settings.aiResponseStyle,
            autoIncludeOfcomCompliance: settings.autoIncludeOfcomCompliance,
            defaultPlaybookHorizon: settings.defaultPlaybookHorizon,
            maxDiscountCapPct: settings.maxDiscountCapPct,
            defaultOfferCostGBP: settings.defaultOfferCostGBP,
            expectedRetentionRatePct: settings.expectedRetentionRatePct,
            revenueHorizonMonths: settings.revenueHorizonMonths,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI retention playbook.');
      }
      const rawPb = data.playbook ?? {};
      const newPlaybook: RetentionPlaybook = {
        id: `pb-${Date.now()}`,
        createdAt: new Date().toISOString(),
        targetType,
        targetId,
        targetLabel,
        title: rawPb.title || `Retention Playbook: ${targetLabel}`,
        priorityTier: rawPb.priorityTier || 'P1 - Immediate Intervention',
        urgencyWindow: rawPb.urgencyWindow || 'Within 48 Hours',
        evidenceDiagnosis:
          rawPb.evidenceDiagnosis || 'Diagnosis grounded in subscriber risk telemetry.',
        citedMetrics: Array.isArray(rawPb.citedMetrics) ? rawPb.citedMetrics : [],
        recommendedOffer: rawPb.recommendedOffer || 'Tailored loyalty lock-in offer',
        messagingAngle: rawPb.messagingAngle || 'Proactive value reassurance and service recovery',
        recommendedChannel: rawPb.recommendedChannel || 'Outbound Call',
        implementationSteps: Array.isArray(rawPb.implementationSteps)
          ? rawPb.implementationSteps
          : [],
        expectedImpact: rawPb.expectedImpact || {
          churnReductionPct: 22,
          retainedMonthlyRevenueGBP: 450,
          retainedAnnualRevenueGBP: 5400,
          estimatedInterventionCostGBP: settings.defaultOfferCostGBP,
          projectedNetRoiPct: 2400,
        },
        measurableKpis: Array.isArray(rawPb.measurableKpis) ? rawPb.measurableKpis : [],
      };

      await persistUpdate({
        ...snapshot,
        playbooks: [newPlaybook, ...snapshot.playbooks],
      });
      notify(`Generated AI Retention Playbook for ${targetLabel}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate playbook.';
      setPlaybookError(msg);
    } finally {
      setIsGeneratingPlaybook(false);
    }
  };

  const handleLaunchCampaignFromPlaybook = async (pb: RetentionPlaybook) => {
    if (!snapshot) return;
    const channelMap: Record<string, RetentionCampaign['channel']> = {
      'Outbound Call': 'Outbound Call',
      Email: 'Email',
      SMS: 'SMS',
      App: 'In-App',
      'In-App': 'In-App',
    };
    const matchedChannel =
      Object.entries(channelMap).find(([k]) =>
        pb.recommendedChannel.toLowerCase().includes(k.toLowerCase())
      )?.[1] ?? 'Multi-Channel';

    const targetSegment =
      pb.targetType === 'segment'
        ? pb.targetLabel
        : snapshot.scoredRows.find((c) => c['Customer ID'] === pb.targetId)?.strategicSegment ??
          'High-Value Flight Risks';

    const segObj = snapshot.segments.find((s) => s.name === targetSegment);
    const newCampaign: RetentionCampaign = {
      id: `camp-${Date.now()}`,
      name: pb.title.slice(0, 56),
      targetSegment,
      channel: matchedChannel,
      offerType: pb.recommendedOffer.slice(0, 72),
      status: 'Active',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      targetCustomers: pb.targetType === 'segment' ? segObj?.customerCount ?? 40 : 1,
      contacted: 0,
      retained: 0,
      campaignCostGBP: Math.max(25, Math.round(pb.expectedImpact.estimatedInterventionCostGBP)),
      revenueSavedGBP: Math.max(0, Math.round(pb.expectedImpact.retainedAnnualRevenueGBP)),
      treatmentChurnPct: Number(Math.max(5, 28 - pb.expectedImpact.churnReductionPct).toFixed(1)),
      controlChurnPct: 28.0,
      createdAt: new Date().toISOString(),
    };

    await persistUpdate({
      ...snapshot,
      campaigns: [newCampaign, ...snapshot.campaigns],
    });
    setActiveView('campaigns');
    notify(`Launched "${newCampaign.name}" into Campaign Tracker.`);
  };

  const handleSaveCampaign = async (campaign: RetentionCampaign) => {
    if (!snapshot) return;
    const exists = snapshot.campaigns.some((c) => c.id === campaign.id);
    const updated = exists
      ? snapshot.campaigns.map((c) => (c.id === campaign.id ? campaign : c))
      : [campaign, ...snapshot.campaigns];
    await persistUpdate({ ...snapshot, campaigns: updated });
    notify(`Saved campaign "${campaign.name}".`);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!snapshot) return;
    await persistUpdate({
      ...snapshot,
      campaigns: snapshot.campaigns.filter((c) => c.id !== id),
    });
    notify('Campaign removed.');
  };

  const handleDeletePlaybook = async (id: string) => {
    if (!snapshot) return;
    await persistUpdate({
      ...snapshot,
      playbooks: snapshot.playbooks.filter((p) => p.id !== id),
    });
  };

  const handleGenerateExecutiveSummary = async () => {
    if (!snapshot) return;
    setSummaryError(null);
    setIsGeneratingSummary(true);
    try {
      const groundedContext = buildGroundedAIContext(snapshot);
      const res = await fetch('/api/ai/executive-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groundedContext }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate executive narrative summary.');
      }
      await persistUpdate({
        ...snapshot,
        executiveSummaryMarkdown: data.summary,
      });
      notify('Executive Narrative Summary updated.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to generate executive narrative summary.';
      setSummaryError(msg);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const criticalCount = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.scoredRows.filter((r) => r.riskTier === 'Critical').length;
  }, [snapshot]);

  const watchlistCount = useMemo(() => {
    if (!snapshot) return 0;
    return computeWatchlistAccounts(snapshot.scoredRows, settings).length;
  }, [snapshot, settings]);

  const activeCampaignCount = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.campaigns.filter((c) => c.status === 'Active').length;
  }, [snapshot]);

  const automatedAlerts = useMemo(() => {
    if (!snapshot) return [];
    return computeAutomatedAlerts(snapshot.scoredRows, snapshot.qualityReport, settings);
  }, [snapshot, settings]);

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] dark:bg-[#06101F] text-[#0B1F3A] dark:text-[#F8FAFC]">
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-8 py-6 text-center shadow-xs">
          <div className="mx-auto h-9 w-9 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] text-[#D4AF37] dark:text-[#040B16] font-display font-bold flex items-center justify-center">
            BC
          </div>
          <div className="mt-3 font-display text-sm font-bold">
            Initializing BritConnect Churn Intelligence
          </div>
          <div className="mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
            Restoring IndexedDB workspace & training ML models...
          </div>
        </div>
      </div>
    );
  }

  const activeMeta = VIEW_META[activeView];

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#F4F6FA] dark:bg-[#06101F] text-[#0F172A] dark:text-[#F8FAFC]">
          {/* Hidden input for Command Palette upload trigger */}
          <input
            ref={paletteUploadRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleUploadFile(file);
                e.target.value = '';
              }
            }}
          />

          <Sidebar
            activeView={activeView}
            onNavigate={(view) => {
              if (view !== 'customers') setCustomerRiskFilterJump('All');
              if (view !== 'watchlist') setWatchlistFilterJump('all');
              setActiveView(view);
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
            criticalCount={criticalCount}
            watchlistCount={watchlistCount}
            activeCampaignCount={activeCampaignCount}
            metadata={snapshot.metadata}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              activeView={activeView}
              sectionLabel={activeMeta.section}
              pageTitle={activeMeta.title}
              pageSubtitle={activeMeta.subtitle}
              metadata={snapshot.metadata}
              alertCount={automatedAlerts.length}
              isDark={isDark}
              copilotOpen={copilotDrawerOpen}
              onOpenMobileMenu={() => setMobileSidebarOpen(true)}
              onToggleTheme={handleToggleTheme}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onOpenAlertDrawer={() => setAlertDrawerOpen(true)}
              onQuickUploadFile={handleUploadFile}
              onQuickExportCSV={() => {
                exportRiskRegisterCSV(snapshot.scoredRows, snapshot.metadata.datasetName);
                notify('Exported Risk Register (.csv).');
              }}
              onQuickExportExcel={() => {
                exportRiskRegisterExcel(snapshot.scoredRows, snapshot.metadata.datasetName);
                notify('Exported Risk Register (.xlsx).');
              }}
              onToggleCopilotDrawer={() => setCopilotDrawerOpen((v) => !v)}
              onRetrainModels={handleRetrainModels}
              onNavigate={(view) => setActiveView(view)}
            />

            <main className="flex-1 p-3.5 sm:p-6 lg:p-7 max-w-[1680px] w-full mx-auto min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeView === 'overview' && (
                  <DashboardOverview
                    customers={snapshot.scoredRows}
                    filters={filters}
                    settings={settings}
                    isDark={isDark}
                    datasetMetadata={snapshot.metadata}
                    onChangeFilters={setFilters}
                    onResetFilters={() => setFilters(DEFAULT_FILTERS)}
                    onNavigateToCustomers={(riskTier) => {
                      setCustomerRiskFilterJump(riskTier || 'All');
                      setActiveView('customers');
                    }}
                    onOpenCopilot={() => setCopilotDrawerOpen(true)}
                    onTriggerUpload={() => paletteUploadRef.current?.click()}
                  />
                )}

                {activeView === 'customers' && (
                  <CustomerIntelligenceView
                    customers={snapshot.scoredRows}
                    segments={snapshot.segments}
                    settings={settings}
                    isDark={isDark}
                    initialRiskFilter={customerRiskFilterJump}
                    onSelectCustomer={(c) => setSelectedCustomer(c)}
                    onGenerateSegmentPlaybook={(seg) => {
                      setPlaybookTargetCustomer(null);
                      setPlaybookTargetSegment(seg);
                      setActiveView('playbooks');
                      void handleGeneratePlaybook('segment', seg.id);
                    }}
                  />
                )}

                {activeView === 'watchlist' && (
                  <WatchlistView
                    customers={snapshot.scoredRows}
                    alerts={automatedAlerts}
                    settings={settings}
                    initialFilter={watchlistFilterJump}
                    onSelectCustomer={(c) => setSelectedCustomer(c)}
                    onGeneratePlaybook={(cust) => {
                      setPlaybookTargetSegment(null);
                      setPlaybookTargetCustomer(cust);
                      setActiveView('playbooks');
                      void handleGeneratePlaybook('customer', cust['Customer ID']);
                    }}
                  />
                )}

                {activeView === 'data-hub' && (
                  <DataHubView
                    metadata={snapshot.metadata}
                    rawRows={snapshot.rawRows}
                    cleanedRows={snapshot.cleanedRows}
                    scoredRows={snapshot.scoredRows}
                    qualityReport={snapshot.qualityReport}
                    settings={settings}
                    onUploadFile={handleUploadFile}
                    onLoadDemo={handleLoadDemo}
                    onResetData={handleResetData}
                    onRemapSchema={handleRemapSchema}
                    isProcessing={isProcessingData}
                  />
                )}

                {activeView === 'model-lab' && (
                  <ModelLabView
                    modelBundle={snapshot.modelBundle}
                    customers={snapshot.scoredRows}
                    settings={settings}
                    isDark={isDark}
                    onSelectChampion={handleSelectChampion}
                    onUpdateThreshold={handleUpdateThreshold}
                    onRetrain={handleRetrainModels}
                    onSelectCustomer={(c) => setSelectedCustomer(c)}
                    isRetraining={isProcessingData}
                  />
                )}

                {activeView === 'playbooks' && (
                  <PlaybooksView
                    customers={snapshot.scoredRows}
                    segments={snapshot.segments}
                    playbooks={snapshot.playbooks}
                    settings={settings}
                    activeTargetCustomer={playbookTargetCustomer}
                    activeTargetSegment={playbookTargetSegment}
                    onGeneratePlaybook={handleGeneratePlaybook}
                    onDeletePlaybook={handleDeletePlaybook}
                    onLaunchCampaign={handleLaunchCampaignFromPlaybook}
                    isGenerating={isGeneratingPlaybook}
                    aiError={playbookError}
                  />
                )}

                {activeView === 'campaigns' && (
                  <CampaignsView
                    campaigns={snapshot.campaigns}
                    segments={snapshot.segments}
                    settings={settings}
                    isDark={isDark}
                    onSaveCampaign={handleSaveCampaign}
                    onDeleteCampaign={handleDeleteCampaign}
                  />
                )}

                {activeView === 'copilot' && (
                  <CopilotPanel
                    messages={snapshot.chatHistory}
                    onSendMessage={handleSendChatMessage}
                    onClearHistory={handleClearChat}
                    isSending={isSendingChat}
                    error={chatError}
                    aiResponseStyle={settings.aiResponseStyle}
                  />
                )}

                {activeView === 'reports' && (
                  <ReportsCenterView
                    snapshot={snapshot}
                    onGenerateExecutiveSummary={handleGenerateExecutiveSummary}
                    isGeneratingSummary={isGeneratingSummary}
                    summaryError={summaryError}
                  />
                )}

                {activeView === 'settings' && (
                  <SettingsView
                    settings={settings}
                    snapshot={snapshot}
                    onUpdateSettings={(next, opts) => void handleUpdateSettings(next, opts)}
                    onResetSettings={() => void handleResetSettings()}
                    onReloadDemoAndClear={() => void handleResetData()}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Customer 360° Profile Drawer */}
        <Customer360Drawer
          customer={selectedCustomer}
          modelBundle={snapshot.modelBundle}
          settings={settings}
          isDark={isDark}
          onClose={() => setSelectedCustomer(null)}
          onGeneratePlaybook={(cust) => {
            setSelectedCustomer(null);
            setPlaybookTargetSegment(null);
            setPlaybookTargetCustomer(cust);
            setActiveView('playbooks');
            void handleGeneratePlaybook('customer', cust['Customer ID']);
          }}
        />

        {/* Slide-Over AI Copilot Drawer */}
        <AnimatePresence>
          {copilotDrawerOpen && activeView !== 'copilot' && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setCopilotDrawerOpen(false)}
                className="no-print fixed inset-0 z-40 bg-[#0B1F3A]/35 dark:bg-[#040B16]/60 backdrop-blur-[1px]"
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="no-print fixed inset-x-0 bottom-0 h-[92dvh] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto z-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-none bg-white dark:bg-[#0D1E36] border-t sm:border-t-0 sm:border-l border-[#E2E8F0] dark:border-[#1E3A5F] shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-end px-4 pt-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCopilotDrawerOpen(false)}
                    aria-label="Close AI Copilot drawer"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#132847] hover:text-[#0B1F3A] dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <CopilotPanel
                    compact
                    messages={snapshot.chatHistory}
                    onSendMessage={handleSendChatMessage}
                    onClearHistory={handleClearChat}
                    isSending={isSendingChat}
                    error={chatError}
                    aiResponseStyle={settings.aiResponseStyle}
                  />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Global Ctrl+K Command Palette */}
        <CommandPaletteModal
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          customers={snapshot.scoredRows}
          isDark={isDark}
          onNavigate={(view) => {
            if (view !== 'customers') setCustomerRiskFilterJump('All');
            setActiveView(view);
          }}
          onSelectCustomer={(cust) => setSelectedCustomer(cust)}
          onJumpToRiskTier={(tier) => {
            setCustomerRiskFilterJump(tier);
            setActiveView('customers');
          }}
          onToggleTheme={handleToggleTheme}
          onOpenCopilot={() => setCopilotDrawerOpen(true)}
          onExportExcel={() => {
            exportRiskRegisterExcel(snapshot.scoredRows, snapshot.metadata.datasetName);
            notify('Exported Risk Register (.xlsx).');
          }}
          onTriggerUpload={() => paletteUploadRef.current?.click()}
        />

        {/* Alert Bell Drawer */}
        <AlertBellDrawer
          open={alertDrawerOpen}
          onClose={() => setAlertDrawerOpen(false)}
          alerts={automatedAlerts}
          onNavigateAlert={(view, hint) => {
            if (view === 'watchlist' && hint) {
              setWatchlistFilterJump(hint);
            }
            setActiveView(view);
          }}
        />
        </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <CrossFilterProvider>
          <AppContent />
        </CrossFilterProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
