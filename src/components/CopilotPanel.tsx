import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, AlertCircle, MessageSquareText } from 'lucide-react';
import type { AIResponseStyle, ChatMessage } from '../types/britconnect';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatTimestamp } from '../utils/formatters';

interface CopilotPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearHistory: () => void;
  isSending: boolean;
  error: string | null;
  compact?: boolean;
  aiResponseStyle?: AIResponseStyle;
}

const STARTER_PROMPTS = [
  'Which UK nation has the highest monthly revenue at risk in Small Business?',
  'Compare churn rates between Month-to-Month and 24-Month plans across services.',
  'Summarize the top 3 drivers of churn and recommend an immediate Q4 retention budget.',
  'List the top 5 highest-risk accounts and their primary risk drivers.',
];

const STYLE_LABELS: Record<AIResponseStyle, string> = {
  executive: 'Executive Brief',
  analytical: 'Analytical Deep-Dive',
  frontline: 'Frontline Retention Agent',
};

export const CopilotPanel: React.FC<CopilotPanelProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
  isSending,
  error,
  compact = false,
  aiResponseStyle = 'executive',
}) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  return (
    <div
      className={`flex flex-col ${
        compact
          ? 'h-full'
          : 'h-[calc(100dvh-140px)] min-h-[440px] sm:min-h-[560px] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] overflow-hidden'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E3A5F] px-5 py-3.5 bg-white dark:bg-[#0D1E36]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B1F3A] dark:bg-[#132847] text-[#D4AF37] dark:text-[#E0B44C]">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
              BritConnect AI Analytics Copilot
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Grounded in live KPIs & top-risk records · Style: {STYLE_LABELS[aiResponseStyle]}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#132847] hover:text-[#8B1E24] dark:hover:text-[#C93842] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8FAFC] dark:bg-[#06101F]">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-4 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
              Ask any question about UK nation revenue exposure, plan churn comparisons, ML model performance,
              or specific high-risk subscribers. Every response is grounded in your active dataset.
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-2">
                Suggested Executive Questions
              </div>
              <div className="grid grid-cols-1 gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isSending}
                    onClick={() => onSendMessage(prompt)}
                    className="rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-3.5 py-2.5 text-left text-xs font-medium text-[#0B1F3A] dark:text-[#F8FAFC] hover:border-[#C89B3C] dark:hover:border-[#E0B44C] hover:bg-[#FFFBEB]/40 dark:hover:bg-[#132847] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#0B1F3A] dark:bg-[#E0B44C] text-white dark:text-[#040B16] text-xs sm:text-sm font-medium'
                  : 'border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] text-[#0F172A] dark:text-[#F8FAFC]'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <MarkdownRenderer content={msg.content} compact={compact} />
              )}
            </div>
            <span className="mt-1 text-[10px] text-[#64748B] dark:text-[#94A3B8] px-1">
              {msg.role === 'user' ? 'You' : 'Copilot'} · {formatTimestamp(msg.timestamp)}
            </span>
          </div>
        ))}

        {isSending && (
          <div className="flex items-start">
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] px-4 py-3 text-xs text-[#475569] dark:text-[#94A3B8]">
              Analysing live BritConnect dataset metrics...
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[#8B1E24]/25 bg-[#FEF2F2] dark:bg-[#8B1E24]/20 px-3.5 py-2.5 text-xs text-[#8B1E24] dark:text-[#FCA5A5]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0D1E36] p-3.5 flex items-center gap-2.5"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about UK churn drivers, nation risk, or retention ROI..."
          className="h-10 min-w-0 flex-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#132847] px-3.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:border-[#0B1F3A] dark:focus:border-[#E0B44C] focus:bg-white dark:focus:bg-[#132847] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-[#E0B44C] px-4 text-xs font-semibold text-white dark:text-[#040B16] hover:bg-[#16325C] dark:hover:bg-[#C89B3C] disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
        >
          <Send className="h-3.5 w-3.5 text-[#D4AF37] dark:text-[#040B16]" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
