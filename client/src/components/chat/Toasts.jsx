import { BellRing, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext.jsx';

export default function Toasts() {
  const { toasts, dismissToast, selectConversation } = useChat();
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="flex w-72 items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-lg">
          <BellRing size={18} className="mt-0.5 text-amber-600" />
          <button className="flex-1 text-left" onClick={() => { selectConversation(t.conversationId); dismissToast(t.id); }}>
            <div className="text-sm font-semibold text-amber-800">{t.title}</div>
            <div className="text-sm text-amber-700">{t.body}</div>
          </button>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-amber-600"><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}
