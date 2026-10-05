import { useChat } from '../../context/ChatContext.jsx';

export default function TypingIndicator({ conversationId }) {
  const { typing, users } = useChat();
  const names = Object.keys(typing[conversationId] || {}).map((id) => users[id]?.name?.split(' ')[0]).filter(Boolean);
  return (
    <div className="h-6 px-4 text-xs text-slate-500" aria-live="polite">
      {names.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5">
            {[0, 1, 2].map((i) => <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />)}
          </span>
          {names.join(', ')} {names.length > 1 ? 'are' : 'is'} typing
        </span>
      )}
    </div>
  );
}
