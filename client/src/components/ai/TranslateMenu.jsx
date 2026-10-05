import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { api } from '../../lib/api.js';

let languagesCache = null;

// Globe icon → language dropdown. Calls back with {lang, text} once translated.
export default function TranslateMenu({ message, onTranslated }) {
  const [open, setOpen] = useState(false);
  const [langs, setLangs] = useState(languagesCache || {});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (open && !languagesCache) {
      api
        .get('/ai/languages')
        .then(({ languages }) => {
          languagesCache = languages;
          setLangs(languages);
        })
        .catch(() => {});
    }
  }, [open]);

  const pick = async (code) => {
    setBusy(code);
    try {
      const { translation } = await api.post('/ai/translate', { messageId: message._id, targetLang: code });
      onTranslated({ lang: code, name: langs[code], text: translation });
      setOpen(false);
    } catch (e) {
      onTranslated({ error: e.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Translate" aria-expanded={open} title="Translate" className="rounded p-1 text-slate-500 hover:bg-slate-200"><Globe size={15} /></button>
      {open && (
        <ul className="absolute right-0 top-7 z-30 max-h-56 w-36 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-slate-800 shadow-lg" onMouseLeave={() => setOpen(false)}>
          {Object.entries(langs).map(([code, name]) => (
            <li key={code}>
              <button onClick={() => pick(code)} className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-100">
                {name}
                {busy === code && <span className="text-xs text-slate-400">…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
