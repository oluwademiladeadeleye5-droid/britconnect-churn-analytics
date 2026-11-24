import React from 'react';

interface MarkdownRendererProps {
  content: string;
  compact?: boolean;
}

function renderInline(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[#0F172A] dark:text-white print:text-[#0F172A]">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-[#F1F5F9] dark:bg-[#132847] print:bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[0.85em] text-[#0B1F3A] dark:text-[#E0B44C] print:text-[#0B1F3A] tabular-nums"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, compact = false }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (!line.trim()) {
      i++;
      continue;
    }

    // Markdown table detection
    if (
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])
    ) {
      const parseCells = (rowStr: string) =>
        rowStr
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseCells(lines[i]));
        i++;
      }

      blocks.push(
        <div
          key={`tbl-${i}`}
          className="my-3 overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] bg-white dark:bg-[#0D1E36] print:bg-white"
        >
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-[#132847] print:bg-[#F8FAFC] border-b border-[#E2E8F0] dark:border-[#1E3A5F] print:border-[#E2E8F0] text-[#475569] dark:text-[#94A3B8] print:text-[#475569]">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-3 py-2 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E3A5F] print:divide-[#F1F5F9]">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#F8FAFC] dark:hover:bg-[#132847]/60 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] print:text-[#0F172A] tabular-nums"
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="mt-4 mb-1.5 font-display text-sm font-semibold text-[#0B1F3A] dark:text-[#E0B44C] print:text-[#0B1F3A]"
        >
          {renderInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="mt-5 mb-2 font-display text-base font-bold text-[#0B1F3A] dark:text-[#F8FAFC] print:text-[#0B1F3A]"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h2
          key={`h1-${i}`}
          className="mt-4 mb-2 font-display text-lg font-bold text-[#0B1F3A] dark:text-[#F8FAFC] print:text-[#0B1F3A]"
        >
          {renderInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul
          key={`ul-${i}`}
          className="my-2 space-y-1.5 pl-4 list-disc marker:text-[#C89B3C] dark:marker:text-[#E0B44C]"
        >
          {items.map((item, idx) => (
            <li
              key={idx}
              className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed text-[#334155] dark:text-[#CBD5E1] print:text-[#334155]`}
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="my-2 space-y-1.5 pl-4 list-decimal marker:font-semibold marker:text-[#0B1F3A] dark:marker:text-[#E0B44C]"
        >
          {items.map((item, idx) => (
            <li
              key={idx}
              className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed text-[#334155] dark:text-[#CBD5E1] print:text-[#334155]`}
            >
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    blocks.push(
      <p
        key={`p-${i}`}
        className={`${compact ? 'text-xs' : 'text-sm'} my-1.5 leading-relaxed text-[#334155] dark:text-[#CBD5E1] print:text-[#334155]`}
      >
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
};
