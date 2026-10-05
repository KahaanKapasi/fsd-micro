import { Check, Loader2, Mic, X } from 'lucide-react';
import { useVoiceToText } from '../../hooks/useVoiceToText.js';

// Animated mic: click to record, live waveform + interim text, check = insert transcript into the input.
export default function VoiceButton({ onTranscript }) {
  const v = useVoiceToText();

  if (!v.supported) return null;

  if (v.status === 'recording') {
    return (
      <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <div className="flex h-6 items-center gap-[2px]" aria-label="Recording waveform">
          {v.levels.map((l, i) => (
            <span key={i} className="w-[3px] rounded bg-red-500 transition-[height]" style={{ height: `${Math.max(12, l * 100)}%` }} />
          ))}
        </div>
        {v.interim && <span className="max-w-[10rem] truncate text-xs text-slate-600">{v.interim}</span>}
        <button type="button" onClick={v.cancel} aria-label="Cancel recording" className="rounded-full p-1 text-slate-500 hover:bg-red-100"><X size={16} /></button>
        <button type="button" onClick={async () => onTranscript(await v.stop())} aria-label="Insert transcribed text" className="rounded-full bg-emerald-500 p-1 text-white hover:bg-emerald-600"><Check size={16} /></button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={v.start}
        disabled={v.status === 'transcribing'}
        aria-label="Voice to text"
        title={v.error || 'Voice to text'}
        className={`rounded-full p-2 hover:bg-slate-100 ${v.error ? 'text-red-500' : 'text-slate-500'}`}
      >
        {v.status === 'transcribing' ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
      </button>
    </div>
  );
}
