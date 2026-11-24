import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientOverload(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 503 ||
    status === 500 ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('503')
  );
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: {
    contents: string;
    config?: Record<string, unknown>;
  }
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: params.contents,
        config: params.config,
      });
    } catch (err: unknown) {
      lastError = err;
      if (!isTransientOverload(err)) {
        throw err;
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  // Fallback to gemini-3.1-flash-lite on transient 503 capacity spikes
  try {
    const fallbackConfig = params.config ? { ...params.config } : undefined;
    if (fallbackConfig && 'thinkingConfig' in fallbackConfig) {
      delete fallbackConfig.thinkingConfig;
    }
    return await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: params.contents,
      config: fallbackConfig,
    });
  } catch (fallbackErr: unknown) {
    console.error('[BritConnect AI Fallback Error]', fallbackErr);
    throw fallbackErr;
  }
}

function formatGeminiError(err: unknown): { status: number; message: string; code: string } {
  console.error('[BritConnect AI Error]', err);
  const rawMessage = err instanceof Error ? err.message : String(err);
  let parsedCode: number | undefined = (err as { status?: number })?.status;
  let parsedStatusText = '';
  let parsedDetail = rawMessage;

  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (obj?.error) {
        parsedCode = parsedCode ?? obj.error.code;
        parsedStatusText = obj.error.status ?? '';
        parsedDetail = obj.error.message ?? rawMessage;
      }
    }
  } catch {
    // ignore JSON parse failure
  }

  const status = typeof parsedCode === 'number' ? parsedCode : 500;

  if (status === 401 || status === 403 || parsedStatusText === 'PERMISSION_DENIED' || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'Gemini API access denied. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (status === 400 || parsedStatusText === 'INVALID_ARGUMENT' || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      code: 'API_KEY_INVALID',
      message: `Gemini API request rejected (${parsedDetail.slice(0, 180)}). Please check Settings > Secrets if using a custom key.`,
    };
  }
  if (status === 404 || parsedStatusText === 'NOT_FOUND') {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: `Gemini model endpoint returned not found: ${parsedDetail.slice(0, 180)}`,
    };
  }
  if (status === 429 || parsedStatusText === 'RESOURCE_EXHAUSTED' || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message: 'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  if (status === 503 || parsedStatusText === 'UNAVAILABLE' || parsedDetail.toLowerCase().includes('high demand')) {
    return {
      status: 503,
      code: 'MODEL_OVERLOADED',
      message: 'The Gemini AI service is temporarily experiencing high demand upstream. Please try again in a few moments (all local ML scoring, dashboards, and exports remain fully functional).',
    };
  }
  return {
    status: 500,
    code: 'GEMINI_ERROR',
    message: `Unable to complete the AI request (${parsedDetail.slice(0, 180)}). Please try again shortly.`,
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({ ok: true, aiConfigured: hasKey, model: PRIMARY_MODEL });
  });

  // 1. Natural-Language Analytics Copilot
  app.post('/api/ai/chat', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'API_KEY_MISSING',
        error: 'Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets to enable the AI Analytics Copilot. All local ML models, filters, and exports remain fully functional.',
      });
      return;
    }

    const { message, history, groundedContext, aiSettings } = req.body as {
      message?: unknown;
      history?: unknown;
      groundedContext?: unknown;
      aiSettings?: {
        aiResponseStyle?: string;
        autoIncludeOfcomCompliance?: boolean;
        maxDiscountCapPct?: number;
      };
    };

    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      res.status(400).json({ error: 'Please provide a valid question (max 4,000 characters).' });
      return;
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (h): h is { role: 'user' | 'assistant'; content: string } =>
              Boolean(h) &&
              (h.role === 'user' || h.role === 'assistant') &&
              typeof h.content === 'string'
          )
          .slice(-10)
      : [];

    const contextString =
      groundedContext && typeof groundedContext === 'object'
        ? JSON.stringify(groundedContext).slice(0, 48000)
        : '{}';

    const styleInstruction =
      aiSettings?.aiResponseStyle === 'analytical'
        ? 'Adopt an Analytical Deep-Dive tone: provide granular statistical breakdowns, multi-column comparison tables, and predictor-level nuances.'
        : aiSettings?.aiResponseStyle === 'frontline'
        ? 'Adopt a Frontline Retention Agent tone: keep analysis brief and emphasize practical call-handling scripts, objection handling, and immediate next actions.'
        : 'Adopt an Executive Brief tone: concise, boardroom-ready, structured around commercial GBP impact and decisive priorities.';

    const complianceInstruction = aiSettings?.autoIncludeOfcomCompliance
      ? 'Always ensure any commercial offer recommendations respect Ofcom UK fairness guidelines (clear pricing, no hidden lock-ins) and respect the maximum discount cap of ' +
        (aiSettings?.maxDiscountCapPct ?? 20) +
        '%.'
      : '';

    const systemInstruction = [
      'You are the BritConnect AI Analytics Copilot, an expert Principal Telecom Retention Strategist and Data Scientist advising UK telecommunications executives.',
      styleInstruction,
      complianceInstruction,
      'STRICT GROUNDING RULES:',
      '1. Answer ONLY using facts, figures, customer IDs, UK nations, plans, campaigns, and model metrics from the LIVE COMPUTED DATASET CONTEXT below.',
      '2. Always format currency in GBP (£) using UK conventions (e.g., £124,580 or £48.50) and percentages cleanly (e.g., 18.4%).',
      '3. When comparing segments, nations, or contracts, include clean Markdown tables or concise KPI callout bullets.',
      '4. Never invent metrics, customer IDs, or statistics not present in the context. If a specific drill-down is not included in the context payload, clearly state what IS visible in the active dataset summary.',
      '5. Keep responses crisp, executive-ready, and actionable (250-550 words unless deeper detail is requested).',
      '',
      'LIVE COMPUTED DATASET CONTEXT (JSON):',
      contextString,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const conversationLines = safeHistory
        .map((m) => `${m.role === 'user' ? 'Executive' : 'Copilot'}: ${m.content.slice(0, 1500)}`)
        .join('\n\n');
      const fullPrompt = conversationLines
        ? `Previous conversation:\n${conversationLines}\n\nCurrent question:\n${message.trim()}`
        : message.trim();

      const response = await generateWithResilience(ai, {
        contents: fullPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ reply: response.text ?? 'No response generated.' });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  // 2. Structured AI Retention Playbook Generator
  app.post('/api/ai/playbook', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'API_KEY_MISSING',
        error: 'Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets to generate AI Retention Playbooks.',
      });
      return;
    }

    const { targetType, targetData, datasetSummary, aiSettings } = req.body as {
      targetType?: unknown;
      targetData?: unknown;
      datasetSummary?: unknown;
      aiSettings?: {
        aiResponseStyle?: string;
        autoIncludeOfcomCompliance?: boolean;
        defaultPlaybookHorizon?: string;
        maxDiscountCapPct?: number;
        defaultOfferCostGBP?: number;
        expectedRetentionRatePct?: number;
        revenueHorizonMonths?: number;
      };
    };

    if ((targetType !== 'customer' && targetType !== 'segment') || !targetData || typeof targetData !== 'object') {
      res.status(400).json({ error: 'Valid targetType ("customer" or "segment") and targetData are required.' });
      return;
    }

    const discountCap = aiSettings?.maxDiscountCapPct ?? 20;
    const offerCost = aiSettings?.defaultOfferCostGBP ?? 35;
    const horizonDesc =
      aiSettings?.defaultPlaybookHorizon === '14-day'
        ? 'Rapid 14-Day Intervention timeline (Day 1, Day 3, Day 7, Day 14 KPIs).'
        : '30-60-90 Day Plan timeline (30-Day, 60-Day, 90-Day KPIs).';
    const ofcomRule = aiSettings?.autoIncludeOfcomCompliance
      ? 'Explicitly include Ofcom-compliant transparency reminders (no hidden auto-renew traps, clear end-of-contract notifications) inside the offer/messaging or implementation steps.'
      : '';

    const systemInstruction = [
      'You are the Chief Retention Architect at BritConnect (UK Telecommunications).',
      'Generate a rigorous, evidence-based, commercially viable retention playbook grounded strictly in the provided customer or segment telemetry.',
      `COMMERCIAL GUARDRAILS: Never recommend a percentage discount exceeding ${discountCap}%. Use £${offerCost} baseline cost per intervened customer and a ${aiSettings?.revenueHorizonMonths ?? 12}-month value horizon with ~${aiSettings?.expectedRetentionRatePct ?? 45}% retention save effectiveness.`,
      `HORIZON & STYLE: Structure measurable KPIs for a ${horizonDesc} Tone preference: ${aiSettings?.aiResponseStyle ?? 'executive'}.`,
      ofcomRule,
      'Every number you cite in diagnosis and financial projections must be mathematically consistent with the input Monthly Charge GBP, Tenure, Complaints 12M, Overage Charges GBP, Resolution Hours, and Churn Probability.',
    ]
      .filter(Boolean)
      .join(' ');

    const prompt = `Target Type: ${targetType}\nTarget Telemetry:\n${JSON.stringify(targetData).slice(0, 16000)}\n\nPortfolio Context:\n${JSON.stringify(datasetSummary ?? {}).slice(0, 8000)}\n\nProduce a structured retention playbook JSON adhering strictly to the schema.`;

    try {
      const response = await generateWithResilience(ai, {
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Concise strategic playbook title.' },
                priorityTier: { type: Type.STRING, description: 'e.g., P1 - Immediate Intervention within 48 Hours' },
                urgencyWindow: { type: Type.STRING, description: 'Specific SLA window (e.g., Within 48 Hours).' },
                evidenceDiagnosis: {
                  type: Type.STRING,
                  description: 'Detailed diagnosis citing exact customer/segment metrics and root risk drivers.',
                },
                citedMetrics: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'List of 4-6 exact cited metric strings, e.g., "Complaints 12M: 4"',
                },
                recommendedOffer: { type: Type.STRING, description: 'Specific UK telecom commercial offer.' },
                messagingAngle: { type: Type.STRING, description: 'Recommended tone, script hook, and value proposition.' },
                recommendedChannel: { type: Type.STRING, description: 'Primary outreach channel (Outbound Call, SMS, Email, App).' },
                implementationSteps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepNumber: { type: Type.INTEGER },
                      action: { type: Type.STRING },
                      responsibleTeam: { type: Type.STRING },
                      channel: { type: Type.STRING },
                      timeline: { type: Type.STRING },
                    },
                  },
                },
                expectedImpact: {
                  type: Type.OBJECT,
                  properties: {
                    churnReductionPct: { type: Type.NUMBER },
                    retainedMonthlyRevenueGBP: { type: Type.NUMBER },
                    retainedAnnualRevenueGBP: { type: Type.NUMBER },
                    estimatedInterventionCostGBP: { type: Type.NUMBER },
                    projectedNetRoiPct: { type: Type.NUMBER },
                  },
                },
                measurableKpis: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      horizon: { type: Type.STRING, description: '30-Day, 60-Day, or 90-Day' },
                      metric: { type: Type.STRING },
                      target: { type: Type.STRING },
                    },
                  },
                },
              },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ playbook: parsed });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  // 3. Executive Narrative Summary for Dashboard & Print-to-PDF Report
  app.post('/api/ai/executive-summary', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'API_KEY_MISSING',
        error: 'Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets to generate Executive Narrative Summaries.',
      });
      return;
    }

    const { groundedContext } = req.body as { groundedContext?: unknown };
    if (!groundedContext || typeof groundedContext !== 'object') {
      res.status(400).json({ error: 'groundedContext object is required.' });
      return;
    }

    const systemInstruction = [
      'You are writing an executive board briefing for the BritConnect Leadership Committee (CEO, CFO, CCO).',
      'Synthesize the live dataset KPIs, regional revenue at risk, ML model findings, and top retention priorities into crisp, authoritative British English prose.',
      'Include three concise sections using Markdown headings: ## Executive Situation, ## Key Risk & Model Findings, and ## Immediate 30-Day Priorities.',
      'Use exact GBP (£) figures and percentages from the supplied JSON only.',
    ].join(' ');

    try {
      const response = await generateWithResilience(ai, {
        contents: `Generate an executive churn intelligence summary from these live portfolio metrics:\n${JSON.stringify(groundedContext).slice(0, 32000)}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ summary: response.text ?? '' });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BritConnect server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
