import { useCallback, useState } from 'react';
import { Hash, ListChecks, Megaphone, Sparkles } from 'lucide-react';
import { useChat } from '../../context/ChatContext.jsx';
import { convoTitle, otherMemberId } from '../../lib/utils.js';
import SummaryPanel from '../ai/SummaryPanel.jsx';
import TaskModal from '../modals/TaskModal.jsx';
import TaskBoard from '../tasks/TaskBoard.jsx';
import Avatar from './Avatar.jsx';
import MessageInput from './MessageInput.jsx';
import MessageList from './MessageList.jsx';
import TypingIndicator from './TypingIndicator.jsx';

export default function ChatWindow() {
  const { active, users, me } = useChat();
  const [board, setBoard] = useState(false);
  const [summary, setSummary] = useState(false);
  const [taskFrom, setTaskFrom] = useState(null);
  const onConvert = useCallback((m) => setTaskFrom(m), []);

  if (!active) {
    return <main className="flex flex-1 items-center justify-center bg-slate-50 text-slate-500">Select a conversation or start a new one</main>;
  }
  const title = convoTitle(active, users, me._id);
  const other = users[otherMemberId(active, me._id)];

  return (
    <div className="flex min-w-0 flex-1">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          {active.type === 'direct' ? <Avatar user={other} showStatus /> : active.type === 'announcement' ? <Megaphone size={20} className="text-slate-500" /> : <Hash size={20} className="text-slate-500" />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{title}</h1>
            <p className="truncate text-xs text-slate-500">
              {active.type === 'direct' ? other?.status || 'offline' : `${active.members.length} members${active.topic ? ` · ${active.topic}` : ''}`}
            </p>
          </div>
          <button onClick={() => setSummary(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100">
            <Sparkles size={16} /> Summarize
          </button>
          <button onClick={() => setBoard((b) => !b)} aria-pressed={board} className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${board ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
            <ListChecks size={16} /> Tasks
          </button>
        </header>
        <MessageList key={active._id} conversation={active} onConvertToTask={onConvert} />
        <TypingIndicator conversationId={active._id} />
        <MessageInput key={active._id} conversation={active} />
      </main>
      {board && <TaskBoard conversation={active} onClose={() => setBoard(false)} />}
      {summary && <SummaryPanel conversation={active} title={title} onClose={() => setSummary(false)} />}
      {taskFrom && <TaskModal conversation={active} initial={{ title: (taskFrom.content || '').slice(0, 200), messageId: taskFrom._id }} onClose={() => setTaskFrom(null)} />}
    </div>
  );
}
