import { useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, Sparkles, X } from 'lucide-react';
import { api } from '../../lib/api.js';

const SECTIONS = [
  ['keyPoints', 'Key discussion points'],
  ['decisions', 'Decisions made'],
  ['openQuestions', 'Pending open questions'],
];

export const summaryToMarkdown = (title, data) =>
  [`# Summary: ${title}`, `_${data.messageCount} messages_`, ...SECTIONS.flatMap(([k, label]) => [`\n## ${label}`, ...(data.summary[k].length ? data.summary[k].map((s) => `- ${s}`) : ['- None'])])].join('\n');

// Slide-over brief. AI runs over HTTP so a slow summary never delays chat delivery.
export default function SummaryPanel({ conversation, title, onClose }) {
  const [limit, setLimit] = useState(50);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    api
      .post('/ai/summarize', { conversationId: conversation._id, limit })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [conversation._id, limit]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const md = data ? summaryToMarkdown(title, data) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    Object.assign(document.createElement('a'), { href: url, download: `summary-${title.replace(/[^\w.-]+/g, '_')}.md` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label="Conversation summary" className="animate-slide-in flex h-full w-full max-w-md flex-col bg-white text-slate-900 shadow-2xl">
        <header className="flex items-center gap-2 border-b border-slate-200 p-4">
          <Sparkles className="text-violet-500" size={20} />
          <h2 className="flex-1 font-semibold">AI summary</h2>
          <button onClick={copy} disabled={!data} aria-label="Copy summary" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40">{copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}</button>
          <button onClick={download} disabled={!data} aria-label="Export summary" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Download size={18} /></button>
          <button onClick={onClose} aria-label="Close" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm text-slate-500">
          Summarize last
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-900">
            {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          messages
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Generating brief…</div>}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {data && !loading && (
            <div className="space-y-5">
              <p className="text-xs text-slate-500">Based on {data.messageCount} messages</p>
              {SECTIONS.map(([k, label]) => (
                <section key={k}>
                  <h3 className="mb-1 text-sm font-semibold text-slate-800">{label}</h3>
                  {data.summary[k].length ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{data.summary[k].map((s, i) => <li key={i}>{s}</li>)}</ul>
                  ) : (
                    <p className="text-sm text-slate-500">None</p>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
